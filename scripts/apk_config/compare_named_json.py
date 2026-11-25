"""Compare decoded APK data with a named upstream snapshot.

Numbers, text, array lengths and member shapes are checked against APK bytes.
Enum labels and member names are correlated with the upstream schema and are
explicitly reported as inferred rather than independently verified metadata.
"""
from collections import Counter
import argparse
import hashlib
import json
from pathlib import Path

from tagged_wire import Node, decode

SCHEMA_LOCK = Path(__file__).with_name('schema-lock.json')


def validate_reference_schema(directory):
    lock = json.loads(SCHEMA_LOCK.read_text())
    for filename, expected_hash in lock['files'].items():
        path = directory / filename
        if not path.is_file():
            raise ValueError(f'Missing pinned schema: {path}')
        actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual_hash != expected_hash:
            raise ValueError(f'Pinned schema hash mismatch: {path}')
    return lock


def unsigned(value):
    return value * 2 if value >= 0 else -value * 2 - 1


def fixed_decimal(node, path=''):
    # APK metadata: EnemyAgeScalingConfig uses F1D, whose UInt64 Raw
    # is divided by its constant Multi=100. The generic wire decoder exposes
    # a zigzag view; recover the original unsigned varint before scaling.
    if path in ('EnemyAgeScalingLibrary[].Damage', 'EnemyAgeScalingLibrary[].Health'):
        if node.wire != 16 or len(node.value) != 1 or node.value[0][0] != 1 or node.value[0][1].wire != 2:
            raise ValueError('Unexpected F1D structure')
        return unsigned(node.value[0][1].value) / 100
    if '<MetaDurationConstant>._value' in path:
        if node.wire != 16 or len(node.value) != 1 or node.value[0][0] != 1 or node.value[0][1].wire != 2:
            raise ValueError('Unexpected MetaDuration structure')
        return node.value[0][1].value
    depth = 0
    while node.wire in (15, 16) and node.value is not None:
        fields = dict(node.value)
        if set(fields) == {1}:
            node = fields[1]
            depth += 1
            continue
        if set(fields) == {1, 2} and all(child.wire == 2 for child in fields.values()) and depth >= 1:
            return (unsigned(fields[1].value) + (unsigned(fields[2].value) << 64)) / 1000000
        break
    raise ValueError('Unsupported numeric structure')


class Comparator:
    def __init__(self):
        self.errors = []
        self.counts = Counter()
        self.enums = {}
        self.member_names = {}
        self.int_modes = {}

    def error(self, path, kind, actual, expected):
        self.errors.append({'path': path, 'kind': kind, 'apk': actual, 'upstream': expected})

    def enum(self, path, value, label):
        mapping = self.enums.setdefault(path, {})
        if value in mapping and mapping[value] != label:
            self.error(path, 'enum_label_conflict', mapping[value], label)
        elif label in mapping.values() and mapping.get(value) != label:
            self.error(path, 'enum_value_conflict', value, label)
        else:
            mapping[value] = label
        self.counts['enum_labels_correlated'] += 1

    def integer(self, node, expected, path):
        if isinstance(expected, bool):
            if node.value not in (0, -1) or (node.value != 0) != expected:
                self.error(path, 'boolean', node.value, expected)
            self.counts['booleans_checked'] += 1
        elif isinstance(expected, str):
            self.enum(path, node.value, expected)
        elif isinstance(expected, (int, float)):
            available = set()
            if node.value == expected:
                available.add('signed-zigzag')
            if not available:
                self.error(path, 'integer', node.value, expected)
            else:
                previous = self.int_modes.get(path, available)
                allowed = previous & available
                if not allowed:
                    self.error(path, 'inconsistent_integer_interpretation', sorted(previous), sorted(available))
                self.int_modes[path] = allowed
            self.counts['numbers_checked'] += 1
        else:
            self.error(path, 'primitive_type', node.value, expected)

    def compare(self, node, expected, path):
        if node.value is None:
            if expected is None:
                self.counts['nulls_checked'] += 1
            elif node.wire == 12 and expected == '':
                self.counts['null_string_rendered_empty'] += 1
            else:
                self.error(path, 'null', None, expected)
            return
        if node.wire in (2, 21):
            self.integer(node, expected, path)
        elif node.wire == 7:
            actual = node.value / (1 << 32)
            if not isinstance(expected, (int, float)) or isinstance(expected, bool) or actual != expected:
                self.error(path, 'q32_32', actual, expected)
            self.counts['numbers_checked'] += 1
        elif node.wire == 8:
            actual = node.plain()
            if actual != expected:
                self.error(path, 'q32_32_vector2', actual, expected)
            self.counts['numbers_checked'] += 2
        elif node.wire == 12:
            if node.value != expected:
                self.error(path, 'string', node.value, expected)
            self.counts['strings_checked'] += 1
        elif node.wire == 18:
            if not isinstance(expected, list):
                self.error(path, 'collection_type', 'list', type(expected).__name__)
                return
            if len(node.value) != len(expected):
                self.error(path, 'collection_size', len(node.value), len(expected))
                return
            self.counts['collection_lengths_checked'] += 1
            for child, item in zip(node.value, expected):
                self.compare(child, item, path + '[]')
        elif node.wire in (14, 15, 16):
            if isinstance(expected, (int, float)) and not isinstance(expected, bool):
                try:
                    actual = fixed_decimal(node, path)
                except ValueError:
                    actual = node.plain()
                if actual != expected:
                    self.error(path, 'numeric_structure', actual, expected)
                self.counts['structured_numbers_checked'] += 1
                return
            if not isinstance(expected, dict):
                self.error(path, 'object_type', node.plain(), expected)
                return
            if '$type' in expected:
                if node.wire != 14:
                    self.error(path, 'polymorphic_wire', node.wire, expected['$type'])
                self.enum(path + '.$type', node.aux, expected['$type'])
                path += '<' + expected['$type'] + '>'
            items = [(name, value) for name, value in expected.items() if name != '$type']
            if len(node.value) != len(items):
                self.error(path, 'member_count', [tag for tag, _ in node.value], [key for key, _ in items])
                return
            self.counts['object_shapes_checked'] += 1
            for (tag, child), (name, value) in zip(node.value, items):
                mapping_key = path + '.tag' + str(tag)
                previous = self.member_names.setdefault(mapping_key, name)
                if previous != name:
                    self.error(mapping_key, 'member_name_conflict', previous, name)
                self.compare(child, value, path + '.' + name)
        else:
            self.error(path, 'unsupported_wire', node.wire, expected)



def run_comparison(mpc_directory, schema_directory, report_path, schema_report_path):
    reference = validate_reference_schema(schema_directory)
    expected_names = {Path(name).stem for name in reference['files']}
    actual_names = {path.stem for path in mpc_directory.glob('*.mpc')}
    if actual_names != expected_names:
        raise ValueError(f'MPC entry set differs from the pinned schema: missing={sorted(expected_names - actual_names)}, extra={sorted(actual_names - expected_names)}')
    rows = []
    schema = {}
    for path in sorted(mpc_directory.glob('*.mpc')):
        upstream = schema_directory / f'{path.stem}.json'
        if not upstream.exists():
            rows.append({'name': path.stem, 'success': False, 'error': 'Missing upstream JSON'})
            continue
        node = decode(path.read_bytes())
        expected = json.loads(upstream.read_text())
        if node.wire == 18 and isinstance(expected, dict):
            expected = list(expected.values())
        comparator = Comparator()
        comparator.compare(node, expected, path.stem)
        rows.append({'name': path.stem, 'success': not comparator.errors,
                     'counts': dict(comparator.counts), 'error_count': len(comparator.errors),
                     'errors': comparator.errors[:30]})
        schema[path.stem] = {'enum_label_correlations': comparator.enums,
                             'member_name_correlations': comparator.member_names,
                             'integer_modes': {key: sorted(value) for key, value in comparator.int_modes.items()}}
    totals = Counter()
    for row in rows:
        totals.update(row.get('counts', {}))
    report = {'schema_reference': {key: value for key, value in reference.items() if key != 'files'},
              'success_count': sum(row['success'] for row in rows),
              'table_count': len(rows), 'total_checks': dict(totals),
              'schema_caveat': 'Member names and enum labels are correlations to the named upstream JSON, not independently recovered IL2CPP declarations.',
              'tables': rows}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    schema_report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    schema_report_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + '\n')
    print('Matching tables', report['success_count'], 'of', report['table_count'])
    print('Checks', dict(totals))
    for row in rows:
        if not row['success']:
            print(row['name'], row.get('error', row.get('error_count')), row.get('errors', [])[:2])
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', type=Path, required=True, help='Input decompressed MPC directory')
    parser.add_argument('--schema-dir', type=Path, required=True, help='Pinned named-schema JSON directory')
    parser.add_argument('--report', type=Path, required=True, help='Output value comparison JSON')
    parser.add_argument('--schema-report', type=Path, required=True, help='Output schema correlation JSON')
    args = parser.parse_args()
    run_comparison(args.input_dir, args.schema_dir, args.report, args.schema_report)
