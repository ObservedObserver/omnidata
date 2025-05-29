import {
    createXLSXParser,
    parseXLSX,
    parseXLSXSimple,
    parseXLSXStream
} from './index';

function createZip(files: Record<string, string>): ArrayBuffer {
    const chunks: Buffer[] = [];
    const zlib = require('zlib');
    for (const name in files) {
        const data = Buffer.from(files[name], 'utf-8');
        const deflated = zlib.deflateRawSync(data);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(0, 6);
        header.writeUInt16LE(8, 8);
        header.writeUInt16LE(0, 10);
        header.writeUInt16LE(0, 12);
        header.writeUInt32LE(0, 14);
        header.writeUInt32LE(deflated.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(Buffer.byteLength(name), 26);
        header.writeUInt16LE(0, 28);
        chunks.push(header, Buffer.from(name, 'utf-8'), deflated);
    }
    const buf = Buffer.concat(chunks);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

function createMockXLSXBuffer(): ArrayBuffer {
    const sheet = `<?xml version="1.0" encoding="UTF-8"?>\n<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row r=\"1\"><c t=\"s\"><v>0</v></c><c t=\"s\"><v>1</v></c><c t=\"s\"><v>2</v></c></row><row r=\"2\"><c t=\"s\"><v>3</v></c><c><v>25</v></c><c t=\"s\"><v>4</v></c></row><row r=\"3\"><c t=\"s\"><v>5</v></c><c><v>30</v></c><c t=\"s\"><v>6</v></c></row></sheetData></worksheet>`;
    const shared = `<?xml version="1.0" encoding="UTF-8"?>\n<sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><si><t>Name</t></si><si><t>Age</t></si><si><t>City</t></si><si><t>John</t></si><si><t>New York</t></si><si><t>Jane</t></si><si><t>Los Angeles</t></si></sst>`;
    return createZip({
        'xl/worksheets/sheet1.xml': sheet,
        'xl/sharedStrings.xml': shared,
    });
}

describe('XLSX Parser', () => {
    test('parseXLSXSimple should parse buffer', async () => {
        const buf = createMockXLSXBuffer();
        const result = await parseXLSXSimple(buf);
        expect(result.headers).toEqual(['Name', 'Age', 'City']);
        expect(result.rows.length).toBe(2);
        expect(result.rows[0].Name).toBe('John');
    });

    test('parseXLSX unified API non-streaming', async () => {
        const buf = createMockXLSXBuffer();
        const result = await parseXLSX(buf);
        expect(result).toBeDefined();
        expect((result as any).rows.length).toBe(2);
    });

    test('parseXLSXStream streaming', async () => {
        const buf = createMockXLSXBuffer();
        const rows: any[] = [];
        await parseXLSXStream(buf as any, {
            onRow: r => rows.push(r)
        });
        expect(rows.length).toBe(2);
    });

    test('createXLSXParser core parse', () => {
        const buf = createMockXLSXBuffer();
        const parser = createXLSXParser();
        const result = parser.parse(buf);
        expect(result.rows.length).toBe(2);
        expect(result.headers[0]).toBe('Name');
    });
});
