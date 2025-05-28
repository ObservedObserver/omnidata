import {
    AvroParser,
    createAvroParser,
    parseAvro,
    parseAvroSimple,
    parseAvroStream,
    AvroType,
} from './index';

describe('Avro Parser', () => {
    function createMockAvroBuffer(): ArrayBuffer {
        const schema = JSON.stringify({
            type: 'record',
            name: 'User',
            fields: [
                { name: 'id', type: 'int' },
                { name: 'name', type: 'string' },
            ],
        });
        const data = JSON.stringify([
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
        ]);
        const enc = new TextEncoder();
        const schemaBytes = enc.encode(schema);
        const dataBytes = enc.encode(data);
        const buffer = new ArrayBuffer(4 + 4 + schemaBytes.length + 4 + dataBytes.length);
        const view = new DataView(buffer);
        const uint8 = new Uint8Array(buffer);
        // magic 'Obj\x01'
        uint8[0] = 0x4f;
        uint8[1] = 0x62;
        uint8[2] = 0x6a;
        uint8[3] = 0x01;
        let offset = 4;
        view.setUint32(offset, schemaBytes.length, true);
        offset += 4;
        uint8.set(schemaBytes, offset);
        offset += schemaBytes.length;
        view.setUint32(offset, dataBytes.length, true);
        offset += 4;
        uint8.set(dataBytes, offset);
        return buffer;
    }

    function createInvalidAvroBuffer(): ArrayBuffer {
        const buffer = new ArrayBuffer(10);
        const u8 = new Uint8Array(buffer);
        // wrong magic
        u8[0] = 0x00;
        u8[1] = 0x00;
        u8[2] = 0x00;
        u8[3] = 0x00;
        return buffer;
    }

    describe('parseAvroSimple', () => {
        test('should parse valid avro buffer', async () => {
            const buf = createMockAvroBuffer();
            const result = await parseAvroSimple(buf);
            expect(result.schema.fields.length).toBe(2);
            expect(result.rows.length).toBe(2);
            expect(result.errors).toHaveLength(0);
        });

        test('should handle invalid buffer', async () => {
            const buf = createInvalidAvroBuffer();
            const result = await parseAvroSimple(buf);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('parseAvro unified API', () => {
        test('should parse non-streaming by default', async () => {
            const buf = createMockAvroBuffer();
            const result = await parseAvro(buf);
            expect(result).toBeDefined();
            expect(result!.rows.length).toBe(2);
        });

        test('should auto-detect streaming when onRow is provided', async () => {
            const buf = createMockAvroBuffer();
            const rows: any[] = [];
            let schema: any = null;
            const result = await parseAvro(buf, {
                onSchema: s => (schema = s),
                onRow: r => rows.push(r),
            });
            expect(result).toBeUndefined();
            expect(schema).toBeDefined();
            expect(rows.length).toBe(2);
        });
    });

    describe('createAvroParser and streaming', () => {
        test('should stream data chunks', () => {
            const buf = createMockAvroBuffer();
            const parser = createAvroParser();
            const rows: any[] = [];
            const stream = parser.parseStream({
                onRow: r => rows.push(r),
            });
            const u8 = new Uint8Array(buf);
            // split in two chunks
            const mid = Math.floor(u8.length / 2);
            stream.write(u8.slice(0, mid));
            stream.write(u8.slice(mid));
            stream.end();
            expect(rows.length).toBe(2);
        });
    });

    describe('enum AvroType', () => {
        test('should expose string values', () => {
            expect(AvroType.STRING).toBe('string');
            expect(AvroType.INT).toBe('int');
        });
    });
});
