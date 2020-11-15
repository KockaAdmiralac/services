const {EventEmitter} = require('events');
const net = require('net');

class Twinkle extends EventEmitter {
    constructor(path) {
        super();
        this.connected = false;
        this.path = path;
        this.connect();
    }
    connect() {
        this.buffer = '';
        this.connection = net.createConnection(this.path)
            .on('connect', this.onConnect.bind(this))
            .on('data', this.onMessage.bind(this))
            .on('error', this.onError.bind(this))
            .on('close', this.onClose.bind(this));
    }
    disconnect() {
        if (this.connected) {
            this.disconnecting = true;
            this.connection.end();
        }
    }
    send(type, data) {
        this.connection.write(`${JSON.stringify({
            type,
            ...data
        })}`);
    }
    message(content) {
        this.send('message', {content});
    }
    delete(message) {
        this.send('delete', {message});
    }
    ping() {
        this.send('ping');
    }
    onConnect() {
        this.connected = true;
        this.emit('connected');
    }
    onMessage(data) {
        for (let chunk of data.toString().trim().split('\n')) {
            if (!chunk.startsWith('{')) {
                chunk = `${this.buffer}${chunk}`;
            }
            if (!chunk.endsWith('}')) {
                this.buffer = chunk;
                continue;
            }
            try {
                const message = JSON.parse(chunk);
                this.emit(message.type, message);
            } catch (error) {
                this.emit('error', error);
            }
        }
    }
    onError(error) {
        this.emit('error', error);
    }
    async onClose() {
        if (this.connected) {
            this.emit('disconnected');
        }
        this.connected = false;
        if (!this.disconnecting) {
            await this.wait(1000);
            this.connect();
        }
    }
    wait(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }
}

module.exports = Twinkle;
