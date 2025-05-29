# omnidata

Data loaders for common file formats. Supports CSV, Parquet, Avro, SQLite and XLSX.

## Installation

```bash
npm install omnidata
```

## Usage

### CSV

```typescript
import { parseCSV } from 'omnidata/csv';

const result = await parseCSV('name,age\nJohn,30', { headers: true });
console.log(result.rows);
```

### Parquet

```typescript
import { parseParquet } from 'omnidata/parquet';

const data = await parseParquet('/path/to/file.parquet');
console.log(data.rows);
```

### Avro

```typescript
import { parseAvro } from 'omnidata/avro';

const data = await parseAvro('/path/to/file.avro');
console.log(data.rows);
```

### SQLite

```typescript
import { parseSQLite } from 'omnidata/sqlite';

const db = await parseSQLite('/path/to/file.sqlite');
console.log(db.tables);
```

### XLSX

```typescript
import { parseXLSX } from 'omnidata/xlsx';

const workbook = await parseXLSX('/path/to/file.xlsx');
console.log(workbook.rows);
```

## API Reference

### CSV

| Function | Description |
| --- | --- |
| `parseCSVSimple(input, options?)` | Parse a small CSV file and return all rows |
| `parseCSV(input, options?)` | Unified parser that auto-detects streaming |
| `parseCSVStream(input, callbacks, options?)` | Streaming parser for large files |

#### CSV Input

- `string` - CSV text
- `File` - browser file object
- `string` - file path in Node.js

#### CSV Options

```ts
interface CSVParseOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  skipEmptyLines?: boolean;
  headers?: boolean | string[];
  encoding?: string;
  chunkSize?: number;
}
```

#### CSV Callbacks

```ts
interface CSVStreamCallbacks {
  onRow?: (row: string[] | CSVRow, index: number) => void;
  onHeaders?: (headers: string[]) => void;
  onError?: (error: CSVError) => void;
  onEnd?: (result: { totalRows: number; errors: CSVError[] }) => void;
}
```

### Parquet

| Function | Description |
| --- | --- |
| `parseParquetSimple(input, options?)` | Parse a Parquet file and return all rows |
| `parseParquet(input, options?)` | Unified parser (non-streaming or streaming) |
| `parseParquetStream(input, callbacks, options?)` | Streaming parser |

#### Parquet Input

- `ArrayBuffer` - binary Parquet data
- `File` - browser file object
- `string` - file path in Node.js

#### Parquet Options

```ts
interface ParquetParseOptions {
  chunkSize?: number;
  encoding?: string;
}
```

#### Parquet Callbacks

```ts
interface ParquetStreamCallbacks {
  onRow?: (row: ParquetRow, index: number) => void;
  onSchema?: (schema: ParquetSchema) => void;
  onError?: (error: ParquetError) => void;
  onEnd?: (result: { totalRows: number; errors: ParquetError[] }) => void;
}
```

### Avro

| Function | Description |
| --- | --- |
| `parseAvroSimple(input, options?)` | Parse an Avro file and return all rows |
| `parseAvro(input, options?)` | Unified parser |
| `parseAvroStream(input, callbacks, options?)` | Streaming parser |

#### Avro Input

- `ArrayBuffer` - binary Avro data
- `File` - browser file object
- `string` - file path in Node.js

#### Avro Options

```ts
interface AvroParseOptions {
  chunkSize?: number;
  encoding?: string;
}
```

#### Avro Callbacks

```ts
interface AvroStreamCallbacks {
  onRow?: (row: AvroRow, index: number) => void;
  onSchema?: (schema: AvroSchema) => void;
  onError?: (error: AvroError) => void;
  onEnd?: (result: { totalRows: number; errors: AvroError[] }) => void;
}
```

### SQLite

| Function | Description |
| --- | --- |
| `parseSQLiteSimple(input, options?)` | Parse an SQLite file and return all tables |
| `parseSQLite(input, options?)` | Unified parser |
| `parseSQLiteStream(input, callbacks, options?)` | Streaming parser |

#### SQLite Input

- `ArrayBuffer` - raw SQLite database bytes
- `File` - browser file object
- `string` - file path in Node.js

#### SQLite Options

```ts
interface SQLiteParseOptions {
  encoding?: string;
}
```

#### SQLite Callbacks

```ts
interface SQLiteStreamCallbacks {
  onTable?: (table: SQLiteTable, index: number) => void;
  onError?: (error: SQLiteError) => void;
  onEnd?: (result: { totalTables: number; errors: SQLiteError[] }) => void;
}
```

### XLSX

| Function | Description |
| --- | --- |
| `parseXLSXSimple(input, options?)` | Parse an XLSX file and return all rows |
| `parseXLSX(input, options?)` | Unified parser |
| `parseXLSXStream(input, callbacks, options?)` | Streaming parser |

#### XLSX Input

- `ArrayBuffer` - XLSX binary data
- `File` - browser file object
- `string` - file path in Node.js

#### XLSX Options

```ts
interface XLSXParseOptions {
  sheet?: number | string;
}
```

#### XLSX Callbacks

```ts
interface XLSXStreamCallbacks {
  onRow?: (row: XLSXRow, index: number) => void;
  onError?: (error: XLSXError) => void;
  onEnd?: (result: { totalRows: number; errors: XLSXError[] }) => void;
}
```
