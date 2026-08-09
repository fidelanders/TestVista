const sensitiveKeys = [
    'authorization', 'token', 'access_token', 'access-token', 'accesstoken',
    'refresh_token', 'refresh-token', 'refreshtoken', 'password', 'secret',
    'client_secret', 'apikey', 'api-key', 'x-api-key', 'cookie', 'set-cookie',
    'jwt', 'bearer'
];

function isSensitive(key) {
    return sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey));
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
        obj.forEach(item => sanitizeObject(item));
        return;
    }

    Object.keys(obj).forEach(key => {
        if (isSensitive(key)) {
            obj[key] = '********';
        } else {
            sanitizeObject(obj[key]);
        }
    });
}

function sanitizeBody(body) {
    if (!body) return body;

    try {
        const parsed = JSON.parse(body);
        sanitizeObject(parsed);
        return JSON.stringify(parsed, null, 2);
    } catch {
        // Handle form-urlencoded or plain text
        let sanitized = body;

        sensitiveKeys.forEach(key => {
            const regex = new RegExp(`(${key}\\s*[=:]\\s*)([^&\\n\\r]+)`, 'ig');
            sanitized = sanitized.replace(regex, '$1********');
        });

        return sanitizeString(sanitized);
    }
}

function sanitizeString(value) {
    if (typeof value !== 'string') return value;

    return value
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer ********')
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '********');
}

function sanitizeFilename(name) {
    return name
        .replace(/[^a-z0-9-_]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Converts a (possibly JSON-round-tripped) response stream into readable text
function bufferToText(stream) {
    if (!stream) return '';
    if (Buffer.isBuffer(stream)) return stream.toString('utf8');
    if (stream.type === 'Buffer' && Array.isArray(stream.data)) {
        return Buffer.from(stream.data).toString('utf8');
    }
    if (typeof stream === 'string') return stream;
    return '';
}

module.exports = {
    sanitizeObject,
    sanitizeBody,
    sanitizeString,
    sanitizeFilename,
    escapeHtml,
    bufferToText
};