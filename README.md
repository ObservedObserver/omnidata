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

### Parquet

| Function | Description |
| --- | --- |
| `parseParquetSimple(input, options?)` | Parse a Parquet file and return all rows |
| `parseParquet(input, options?)` | Unified parser (non-streaming or streaming) |
| `parseParquetStream(input, callbacks, options?)` | Streaming parser |

### Avro

| Function | Description |
| --- | --- |
| `parseAvroSimple(input, options?)` | Parse an Avro file and return all rows |
| `parseAvro(input, options?)` | Unified parser |
| `parseAvroStream(input, callbacks, options?)` | Streaming parser |

### SQLite

| Function | Description |
| --- | --- |
| `parseSQLiteSimple(input, options?)` | Parse an SQLite file and return all tables |
| `parseSQLite(input, options?)` | Unified parser |
| `parseSQLiteStream(input, callbacks, options?)` | Streaming parser |

### XLSX

| Function | Description |
| --- | --- |
| `parseXLSXSimple(input, options?)` | Parse an XLSX file and return all rows |
| `parseXLSX(input, options?)` | Unified parser |
| `parseXLSXStream(input, callbacks, options?)` | Streaming parser |
