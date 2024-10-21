export function isPlainObject(_object: object) {
    return (
        !!_object &&
        typeof _object === "object" &&
        Object.prototype.toString.call(_object) === "[object Object]"
    );
}
