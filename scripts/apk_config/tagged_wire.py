"""Lossless decoder for observed MPC tagged-wire primitives, without enum guesses.

Unknown wire types and unsupported nullable variants fail closed. Every decoded
entry must consume all input bytes and re-encode to exactly the original bytes.
"""
from dataclasses import dataclass
import argparse
import hashlib
import json
from pathlib import Path
import struct


def varint(value):
    number = value * 2 if value >= 0 else -value * 2 - 1
    result = bytearray()
    while number >= 128:
        result.append((number & 127) | 128)
        number >>= 7
    result.append(number)
    return bytes(result)


@dataclass
class Node:
    wire: int
    value: object
    aux: object = None

    def plain(self):
        if self.wire == 7:
            return self.value / (1 << 32)
        if self.wire == 8:
            return {'X': self.value[0] / (1 << 32), 'Y': self.value[1] / (1 << 32)}
        if self.wire in (14, 15, 16):
            if self.value is None:
                return None
            fields = {str(tag): value.plain() for tag, value in self.value}
            if self.wire in (14, 15):
                fields['_type_code'] = self.aux
            return fields
        if self.wire == 18:
            return None if self.value is None else [entry.plain() for entry in self.value]
        return self.value

    def encode_value(self):
        if self.wire == 2:
            return varint(self.value)
        if self.wire == 7:
            return struct.pack('>q', self.value)
        if self.wire == 8:
            return struct.pack('>qq', *self.value)
        if self.wire == 12:
            if self.value is None:
                return varint(-1)
            data = self.value.encode('utf-8')
            return varint(len(data)) + data
        if self.wire == 21:
            return varint(0) if self.value is None else varint(1) + varint(self.value)
        if self.wire in (14, 15, 16):
            prefix = varint(self.aux) if self.wire in (14, 15) else b''
            if self.value is None:
                return prefix
            return prefix + b''.join(bytes([value.wire]) + varint(tag) + value.encode_value()
                                     for tag, value in self.value) + b'\x11'
        if self.wire == 18:
            if self.value is None:
                return varint(-1)
            return varint(len(self.value)) + bytes([self.aux]) + b''.join(
                entry.encode_value() for entry in self.value)
        raise ValueError(f'Cannot encode wire {self.wire}')


class Reader:
    def __init__(self, data):
        self.data = data
        self.offset = 0

    def take(self, length):
        if length < 0 or self.offset + length > len(self.data):
            raise ValueError(f'Truncated at offset {self.offset}, requested {length}')
        value = self.data[self.offset:self.offset + length]
        self.offset += length
        return value

    def integer(self):
        unsigned = shift = 0
        for _ in range(20):
            byte = self.take(1)[0]
            unsigned |= (byte & 127) << shift
            if not byte & 128:
                return (unsigned >> 1) ^ -(unsigned & 1)
            shift += 7
        raise ValueError('Oversized varint')

    def fields(self, depth):
        fields = []
        seen = set()
        while True:
            wire = self.take(1)[0]
            if wire == 17:
                return fields
            tag = self.integer()
            if tag <= 0 or tag in seen:
                raise ValueError(f'Invalid/duplicate field tag {tag} at offset {self.offset}')
            seen.add(tag)
            fields.append((tag, self.value(wire, depth + 1)))

    def value(self, wire, depth=0):
        if depth > 100:
            raise ValueError('Nesting limit exceeded')
        if wire == 2:
            return Node(wire, self.integer())
        if wire == 7:
            return Node(wire, struct.unpack('>q', self.take(8))[0])
        if wire == 8:
            return Node(wire, list(struct.unpack('>qq', self.take(16))))
        if wire == 12:
            length = self.integer()
            if length < -1:
                raise ValueError('Invalid string length')
            return Node(wire, None if length == -1 else self.take(length).decode('utf-8'))
        if wire == 21:
            marker = self.integer()
            if marker not in (0, 1):
                raise ValueError(f'Unsupported wire21 marker {marker} at offset {self.offset}')
            return Node(wire, None if marker == 0 else self.integer())
        if wire in (14, 15):
            type_code = self.integer()
            if type_code < 0:
                raise ValueError(f'Negative class type code {type_code}')
            if wire == 15 and type_code not in (0, 1):
                raise ValueError(f'Unexpected wire15 presence marker {type_code}')
            return Node(wire, None if type_code == 0 else self.fields(depth), type_code)
        if wire == 16:
            return Node(wire, self.fields(depth))
        if wire == 18:
            length = self.integer()
            if length < -1 or length > 1000000:
                raise ValueError(f'Invalid collection size {length}')
            if length == -1:
                return Node(wire, None)
            element_wire = self.take(1)[0]
            return Node(wire, [self.value(element_wire, depth + 1) for _ in range(length)], element_wire)
        raise ValueError(f'Unsupported wire {wire} at offset {self.offset - 1}')


def decode(data):
    reader = Reader(data)
    root = reader.value(reader.take(1)[0])
    if reader.offset != len(data):
        raise ValueError(f'Unconsumed bytes: consumed {reader.offset} of {len(data)}')
    encoded = bytes([root.wire]) + root.encode_value()
    if encoded != data:
        raise ValueError('Lossless round-trip failed')
    return root


def inspect_directory(directory, output, manifest_path):
    results = []
    pending = []
    sources = sorted(directory.glob('*.mpc'))
    if not sources:
        raise ValueError(f'No MPC files in {directory}')
    for path in sources:
        data = path.read_bytes()
        row = {'name': path.stem, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        try:
            root = decode(data)
            value = root.plain()
            destination = output / f'{path.stem}.json'
            pending.append((destination, json.dumps(value, ensure_ascii=False, indent=2) + '\n'))
            row.update(success=True, round_trip_equal=True, complete_consumption=True,
                       path=str(destination), root_wire=root.wire,
                       row_count=len(value) if isinstance(value, list) else None)
        except Exception as error:
            row.update(success=False, error=str(error))
        results.append(row)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(results, indent=2) + '\n')
    if all(row['success'] for row in results):
        output.mkdir(parents=True, exist_ok=True)
        for destination, payload in pending:
            destination.write_text(payload)
    print('Parsed', sum(row['success'] for row in results), 'of', len(results))
    for row in results:
        if not row['success']:
            print(row['name'], row['error'])
    return all(row['success'] for row in results)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', type=Path, required=True, help='Input decompressed MPC directory')
    parser.add_argument('--output-dir', type=Path, required=True, help='Output numeric tagged-tree directory')
    parser.add_argument('--manifest', type=Path, required=True, help='Output decode validation manifest JSON')
    args = parser.parse_args()
    raise SystemExit(0 if inspect_directory(args.input_dir, args.output_dir, args.manifest) else 1)
