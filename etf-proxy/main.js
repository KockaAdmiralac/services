import express from 'express';
import got from 'got';
import {CookieJar} from 'tough-cookie';

const stats = {
    requests: 0,
    unauthorized: 0,
    malformedBody: 0,
    missingUrl: 0,
    successful: 0,
    httpError: 0,
    unknownError: 0,
    active: 0
};

const cookieJar = new CookieJar();
const token = process.env.ETF_PROXY_TOKEN ?
    process.env.ETF_PROXY_TOKEN :
    (await import('./config.json', {
        assert: {
            type: 'json'
        }
    })).default.token;
const PROXY_HEADERS = [
    'Accept',
    'User-Agent',
    'X-Requested-With'
];

const app = express();
app.use(express.json());
app.post('/', async function(request, response) {
    ++stats.requests;
    ++stats.active;
    if (request.headers['authorization'] !== `Bearer ${token}`) {
        ++stats.unauthorized;
        --stats.active;
        response.status(401).json({
            error: 'Unauthorized',
            message: 'You did not provide valid credentials before accessing this resource.'
        });
        return;
    }
    if (!request.body || typeof request.body !== 'object') {
        ++stats.malformedBody;
        --stats.active;
        response.status(400).json({
            error: 'Malformed body',
            message: 'Your body could not be parsed into a JSON object.'
        });
        return;
    }
    const {options, url} = request.body;
    if (!url) {
        ++stats.missingUrl;
        --stats.active;
        response.status(400).json({
            error: 'Missing URL',
            message: 'You need to provide a `url` property in the body of your request.'
        });
        return;
    }
    const headers = {};
    for (const header of PROXY_HEADERS) {
        const value = request.headers[header.toLowerCase()];
        if (value) {
            headers[header] = value;
        }
    }
    headers['User-Agent'] = headers['User-Agent'] || 'etf-proxy';
    try {
        const data = await got(url, {
            cookieJar,
            headers,
            ...options
        }).text();
        ++stats.successful;
        --stats.active;
        response.status(200).json({
            body: data
        });
    } catch (error) {
        --stats.active;
        if (error && error.response && error.response.statusCode) {
            ++stats.httpError;
            response.status(error.response.statusCode).json({
                error: 'HTTP error',
                message: 'The HTTP request returned an error.',
                body: error.response.body
            });
        } else {
            ++stats.unknownError;
            console.error(error);
            response.status(500).json({
                error: 'HTTP error',
                message: 'An unknown error occurred.',
                stack: error.stack
            })
        }
    }
});

app.get('/stats', function(_, response) {
    response.status(200).json(stats);
});

app.listen(process.env.PORT || 80);
