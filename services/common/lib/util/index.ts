/**
 * Copied from Java tier in file "AsciiHexStringConverter"
 *
 * @export
 * @param {string} s
 * @returns {string}
 */
export function convertStringToAsciiEncodedString(s: string): string {
    if (!s) return null;

    let n: string = '\\x';
    for (let i = 0; i < s.length; i++) {
        const charValue: number = s.charCodeAt(i); // Get char code from string value
        let strValue: string = charValue.toString(16);
        if (strValue.length < 2) {
            strValue = '0' + strValue;
        }
        n += strValue;
    }
    return n;
}

/**
 * Copied from Java tier in file "AsciiHexStringConverter"
 *
 * @export
 * @param {string} s
 * @returns {string}
 */
export function convertAsciiEncodedString(s: string): string {
    let n: string = '';
    //Starting at index 2 to avoid the initial escape/character
    for (let i = 2; i < s.length; i += 2) {
        let str = s.substring(i, i + 2);
        n += String.fromCharCode(parseInt(str, 16));
    }
    return n.toString();
}

export function formatBufferColumnToBase64(field: string) {
    return Buffer.from(field).toString('base64');
}

export function formatBase64ToBufferColumn(field: string) {
    return new Buffer(field, 'base64');
}
