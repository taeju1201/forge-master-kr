"""Export APK MPC values under a pinned, shape-checked named schema.

No balancing values are copied from the schema: primitive and structured numbers,
booleans and text come from decoded APK bytes. Field names, enum labels and
polymorphic type names come from the explicitly documented upstream reference.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

from compare_named_json import Comparator, fixed_decimal, validate_reference_schema
from tagged_wire import decode


def convert(node, template, path, counters):
    if node.value is None:
        counters['null_values'] += 1
        return None
    if node.wire in (2, 21):
        if isinstance(template, bool):
            if node.value not in (0, -1):
                raise ValueError(f'Unexpected boolean representation at {path}')
            return node.value != 0
        if isinstance(template, str):
            # Comparator already checked a consistent bijective code/name map.
            counters['enum_labels_from_reference'] += 1
            return template
        if isinstance(template, (int, float)):
            counters['numeric_values_from_apk'] += 1
            return node.value
        raise ValueError(f'Unsupported integer schema at {path}')
    if node.wire == 7:
        counters['numeric_values_from_apk'] += 1
        return node.value / (1 << 32)
    if node.wire == 8:
        counters['numeric_values_from_apk'] += 2
        return node.plain()
    if node.wire == 12:
        counters['text_values_from_apk'] += 1
        return node.value
    if node.wire == 18:
        if not isinstance(template, list) or len(template) != len(node.value):
            raise ValueError(f'Collection shape mismatch at {path}')
        return [convert(child, seed, path + '[]', counters) for child, seed in zip(node.value, template)]
    if node.wire in (14, 15, 16):
        if isinstance(template, (int, float)) and not isinstance(template, bool):
            counters['numeric_values_from_apk'] += 1
            return fixed_decimal(node, path)
        if not isinstance(template, dict):
            raise ValueError(f'Object schema mismatch at {path}')
        items = [(name, value) for name, value in template.items() if name != '$type']
        if len(items) != len(node.value):
            raise ValueError(f'Member shape mismatch at {path}')
        typed_path = path + '<' + template['$type'] + '>' if '$type' in template else path
        value = {name: convert(child, seed, typed_path + '.' + name, counters)
                 for (_, child), (name, seed) in zip(node.value, items)}
        if '$type' in template:
            value['$type'] = template['$type']
            counters['polymorphic_labels_from_reference'] += 1
        return value
    raise ValueError(f'Unsupported wire type {node.wire} at {path}')


def build(mpc_directory, schema_directory, output, archive_manifest, manifest_path,
          schema_manifest_path, game_version):
    reference = validate_reference_schema(schema_directory)
    pending = []
    summary = []
    totals = Counter()
    schemas = {}
    allowed_differences = {'integer', 'q32_32', 'numeric_structure', 'string'}
    for source in sorted(mpc_directory.glob('*.mpc')):
        data = source.read_bytes()
        node = decode(data)  # Full consumption + byte-exact round trip are mandatory.
        schema_path = schema_directory / f'{source.stem}.json'
        template = json.loads(schema_path.read_text())
        is_library = node.wire == 18 and isinstance(template, dict)
        reference_rows = list(template.values()) if is_library else template
        checker = Comparator()
        checker.compare(node, reference_rows, source.stem)
        structural_errors = [error for error in checker.errors if error['kind'] not in allowed_differences]
        if structural_errors:
            raise ValueError(f'{source.stem}: schema mismatch: {structural_errors[:3]}')
        counters = Counter()
        converted = convert(node, reference_rows, source.stem, counters)
        if is_library:
            named = {}
            for original_key, original_row, actual_row in zip(template, reference_rows, converted):
                key = original_key
                if original_row:
                    first_name = next(iter(original_row))
                    original_id = original_row[first_name]
                    actual_id = actual_row[first_name]
                    if actual_id != original_id:
                        if original_key != str(original_id):
                            raise ValueError(f'{source.stem}: changed opaque row identity {original_key}')
                        key = str(actual_id)
                if key in named:
                    raise ValueError(f'{source.stem}: duplicate row key {key}')
                named[key] = actual_row
            converted = named
        payload = (json.dumps(converted, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        path = output / f'{source.stem}.json'
        pending.append((path, payload))
        totals.update(counters)
        summary.append({'name': source.stem, 'source_mpc_sha256': hashlib.sha256(data).hexdigest(),
                        'source_mpc_bytes': len(data), 'output_filename': path.name,
                        'output_sha256': hashlib.sha256(payload).hexdigest(),
                        'complete_consumption': True, 'byte_exact_round_trip': True,
                        'row_count': len(converted) if is_library else None,
                        'reference_schema_file': schema_path.name,
                        'reference_schema_sha256': hashlib.sha256(schema_path.read_bytes()).hexdigest(),
                        'value_differences_from_reference': checker.errors,
                        'null_strings_preserved_as_null': checker.counts['null_string_rendered_empty'],
                        'counts': dict(counters)})
        schemas[source.stem] = {'enum_labels': checker.enums, 'member_names': checker.member_names}
    if len(pending) != len(reference['files']):
        raise ValueError(f'Expected {len(reference["files"])} archive entries, found {len(pending)}')
    archive = json.loads(archive_manifest.read_text())
    archive_entries = {entry['name']: entry for entry in archive['entries']}
    for row in summary:
        entry = archive_entries.get(row['name'] + '.mpc')
        if entry is None or entry['decoded_sha256'] != row['source_mpc_sha256']:
            raise ValueError(f'Extraction manifest does not match MPC input: {row["name"]}')
    # Publish only after all payloads, schema shapes and extraction hashes pass.
    output.mkdir(parents=True, exist_ok=True)
    for path, payload in pending:
        path.write_bytes(payload)
    manifest = {
        'game_version': game_version,
        'game_version_evidence': 'Explicit CLI value; verify against the input package manifest or Unity PlayerSettings.',
        'data_scope': 'Embedded SharedGameConfig.mpa from the user-supplied APK',
        'server_hot_update_equivalence_claimed': False,
        'table_count': len(summary), 'all_tables_consumed_completely': True,
        'all_tables_round_trip_byte_exact': True,
        'round_trip_subject': 'Typed MPC tree before projection into floating-point JSON',
        'numeric_values_source': 'Decoded MPC payload, never the reference schema',
        'field_and_enum_names_source': str(schema_directory),
        'schema_reference': {key: value for key, value in reference.items() if key != 'files'},
        'schema_limit': 'Names and enum labels are correlated against the pinned reference; numeric and textual payloads are from APK bytes.',
        'numeric_rules': {
            'wire7': 'Signed big-endian Q32.32 / 2^32',
            'wire8': 'Two signed big-endian Q32.32 coordinates',
            'ordinary_wire2': 'Signed zigzag integer; bool is 0 or -1',
            'F1D': 'EnemyAgeScalingConfig getters return F1D; F1D.Raw getter returns UInt64; recover unsigned varint and divide by metadata constant Multi=100',
            'FD6': 'Recover two UInt64 words from nested tagged structs, combine into the observed non-negative 128-bit value, divide by metadata Precision=1000000',
            'MetaDuration': 'Single tagged signed Milliseconds field',
        },
        'apk_metadata_evidence': {
            'EnemyAgeScalingConfig.get_Damage': {'method_index': 61992, 'return_type_index': 50658, 'type': 'Metaplay.Core.Math.F1D'},
            'EnemyAgeScalingConfig.get_Health': {'method_index': 61994, 'return_type_index': 50658, 'type': 'Metaplay.Core.Math.F1D'},
            'F1D.get_Raw': {'method_index': 17301, 'return_type_index': 66100, 'type': 'System.UInt64'},
            'F1D.Multi': {'field_index': 5232, 'constant_data_index': 92084, 'value': 100},
            'FD6.Precision': {'field_index': 5250, 'constant_data_index': 92100, 'value': 1000000},
        },
        'archive': {key: value for key, value in archive.items() if key != 'entries'},
        'counts': dict(totals), 'tables': summary,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    schema_manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    schema_manifest_path.write_text(json.dumps(schemas, ensure_ascii=False, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', type=Path, required=True, help='Input decompressed MPC directory')
    parser.add_argument('--schema-dir', type=Path, required=True, help='Pinned named-schema JSON directory')
    parser.add_argument('--output-dir', type=Path, required=True, help='Output named JSON directory')
    parser.add_argument('--archive-manifest', type=Path, required=True, help='Input extraction manifest JSON')
    parser.add_argument('--manifest', type=Path, required=True, help='Output named-data provenance JSON')
    parser.add_argument('--schema-manifest', type=Path, required=True, help='Output named-schema correlations JSON')
    parser.add_argument('--game-version', required=True, help='Package version independently verified by the caller')
    args = parser.parse_args()
    result = build(args.input_dir, args.schema_dir, args.output_dir, args.archive_manifest,
                   args.manifest, args.schema_manifest, args.game_version)
    print('Exported', result['table_count'], 'named tables from APK payloads')
    print('Value differences from reference:', {row['name']: len(row['value_differences_from_reference'])
                                               for row in result['tables'] if row['value_differences_from_reference']})
    print('Null strings preserved:', sum(row['null_strings_preserved_as_null'] for row in result['tables']))
    print('Output:', args.output_dir)
