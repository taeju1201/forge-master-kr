"""Extract the observed MCA! v5 archive into intact, decompressed MPC entries."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import struct
import zlib


def extract(source, destination, manifest_path):
    data = source.read_bytes()
    if len(data) < 36:
        raise ValueError('Truncated archive header')
    magic, version, archive_hash, timestamp, count = struct.unpack('>4sI16sQI', data[:36])
    if magic != b'MCA!' or version != 5:
        raise ValueError(f'Unsupported archive: {magic!r}, version {version}')
    offset = 36
    entries = []
    names = set()
    for _ in range(count):
        value = shift = 0
        while True:
            if offset >= len(data) or shift > 63:
                raise ValueError('Invalid entry name length')
            byte = data[offset]
            offset += 1
            value |= (byte & 127) << shift
            if not byte & 128:
                break
            shift += 7
        length = (value >> 1) ^ -(value & 1)
        if length <= 0 or offset + length + 24 > len(data):
            raise ValueError('Invalid entry directory')
        name = data[offset:offset + length].decode('utf-8')
        offset += length
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*\.mpc', name):
            raise ValueError(f'Unexpected entry name: {name!r}')
        if name in names:
            raise ValueError(f'Duplicate entry name: {name}')
        names.add(name)
        entry_hash = data[offset:offset + 16].hex()
        offset += 16
        compression, size = struct.unpack('>II', data[offset:offset + 8])
        offset += 8
        if compression not in (0, 1):
            raise ValueError(f'Unsupported compression: {compression}')
        entries.append({'name': name, 'hash128': entry_hash, 'compression': compression,
                        'stored_bytes': size})
    directory_end = offset
    pending = []
    for entry in entries:
        size = entry['stored_bytes']
        stored = data[offset:offset + size]
        if len(stored) != size:
            raise ValueError(f'Truncated payload: {entry["name"]}')
        entry['archive_offset'] = offset
        offset += size
        if entry['compression'] == 1:
            decompressor = zlib.decompressobj(-15)
            decoded = decompressor.decompress(stored) + decompressor.flush()
            if not decompressor.eof or decompressor.unused_data or decompressor.unconsumed_tail:
                raise ValueError(f'Incomplete deflate payload: {entry["name"]}')
        else:
            decoded = stored
        entry['decoded_bytes'] = len(decoded)
        entry['stored_sha256'] = hashlib.sha256(stored).hexdigest()
        entry['decoded_sha256'] = hashlib.sha256(decoded).hexdigest()
        entry['decoded_md5'] = hashlib.md5(decoded).hexdigest()
        entry['path'] = str(destination / entry['name'])
        pending.append((destination / entry['name'], decoded))
    if offset != len(data):
        raise ValueError(f'Archive has {len(data) - offset} unexplained trailing bytes')
    result = {'source': str(source), 'source_sha256': hashlib.sha256(data).hexdigest(),
              'archive_format': version, 'archive_hash128': archive_hash.hex(),
              'archive_timestamp_ms': timestamp,
              'archive_timestamp_utc': datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat(),
              'entry_count': count, 'directory_end': directory_end,
              'archive_bytes': len(data), 'entries': entries}
    if source.resolve() == manifest_path.resolve():
        raise ValueError('The output manifest must not overwrite the source archive')
    destination.mkdir(parents=True, exist_ok=True)
    for path, decoded in pending:
        path.write_bytes(decoded)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True, help='Input SharedGameConfig.mpa')
    parser.add_argument('--output-dir', type=Path, required=True, help='Output decompressed MPC directory')
    parser.add_argument('--manifest', type=Path, required=True, help='Output extraction manifest JSON')
    args = parser.parse_args()
    result = extract(args.source, args.output_dir, args.manifest)
    print(json.dumps({key: value for key, value in result.items() if key != 'entries'}, indent=2))
