import { gzipSync, gunzipSync, crc32 } from "node:zlib";
import type { RecipeFile } from "./types.js";

function comparePaths(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function padded(contents: Uint8Array): Buffer {
  const pad = (512 - (contents.byteLength % 512)) % 512;
  return Buffer.concat([Buffer.from(contents), Buffer.alloc(pad)]);
}

function splitTarPath(filePath: string): { name: string; prefix: string } {
  if (Buffer.byteLength(filePath) <= 100) {
    return { name: filePath, prefix: "" };
  }
  const slash = filePath.lastIndexOf("/");
  if (slash <= 0) {
    throw new Error(`Recipe path is too long for the archive: ${filePath}`);
  }
  const prefix = filePath.slice(0, slash);
  const name = filePath.slice(slash + 1);
  if (Buffer.byteLength(prefix) > 155 || Buffer.byteLength(name) > 100) {
    throw new Error(`Recipe path is too long for the archive: ${filePath}`);
  }
  return { name, prefix };
}

function writeOctal(
  header: Buffer,
  value: number,
  offset: number,
  length: number,
): void {
  const text = value.toString(8).padStart(length - 1, "0");
  header.write(text.slice(-(length - 1)), offset, length - 1, "ascii");
  header[offset + length - 1] = 0;
}

function tarHeader(filePath: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  const parts = splitTarPath(filePath);
  header.write(parts.name, 0, "utf8");
  writeOctal(header, 0o644, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write("ustar", 257, "ascii");
  header[262] = 0;
  header.write("00", 263, "ascii");
  if (parts.prefix.length > 0) {
    header.write(parts.prefix, 345, "utf8");
  }
  let sum = 0;
  for (const byte of header) {
    sum += byte;
  }
  const checksum = sum.toString(8).padStart(6, "0");
  header.write(checksum, 148, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

export function archivePaths(
  directoryName: string,
  files: RecipeFile[],
): RecipeFile[] {
  return [...files]
    .sort(function byPath(left, right) {
      return comparePaths(left.path, right.path);
    })
    .map(function prefix(file) {
      return {
        path: `${directoryName}/${file.path}`,
        contents: file.contents,
      };
    });
}

export function tarRecipeArchive(
  directoryName: string,
  files: RecipeFile[],
): Uint8Array {
  const chunks: Buffer[] = [];
  for (const file of archivePaths(directoryName, files)) {
    chunks.push(tarHeader(file.path, file.contents.byteLength));
    chunks.push(padded(file.contents));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

export function tarGzRecipeArchive(
  directoryName: string,
  files: RecipeFile[],
): Uint8Array {
  const tar = tarRecipeArchive(directoryName, files);
  const options = { level: 9, mtime: 0 };
  return gzipSync(tar, options);
}

export function listTarPaths(archive: Uint8Array): string[] {
  const tar = gunzipSync(archive);
  const paths: string[] = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (
      header.every(function isZero(byte) {
        return byte === 0;
      })
    ) {
      break;
    }
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/u, "");
    const prefix = header
      .subarray(345, 500)
      .toString("utf8")
      .replace(/\0.*$/u, "");
    const sizeText = header
      .subarray(124, 136)
      .toString("ascii")
      .replace(/\0.*$/u, "")
      .trim();
    const size = Number.parseInt(sizeText, 8);
    paths.push(prefix.length > 0 ? `${prefix}/${name}` : name);
    const blocks = Math.ceil(size / 512);
    offset += blocks * 512;
  }
  return paths;
}

export function zipRecipeArchive(
  directoryName: string,
  files: RecipeFile[],
): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of archivePaths(directoryName, files)) {
    const name = Buffer.from(file.path, "utf8");
    const data = Buffer.from(file.contents);
    const checksum = crc32(data) >>> 0;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centrals.reduce(function sum(total, chunk) {
    return total + chunk.length;
  }, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}
