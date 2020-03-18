# auto-lab
Automatic signup for [RTI labs](https://rti.etf.bg.ac.rs/labvezbe/) written in [Node.js](https://nodejs.org).

## Installation
To install dependencies for this project, navigate to the project directory and use:
```console
$ npm install
```

## Configuration
Rename the `config.sample.json` file to `config.json` and change the fields as following:
- `autoSignupRegex`: Regular expression for lab names that the service should automatically sign up for. Optional.
- `discord`: Configuration of the Discord webhook to relay logs of new labs and lab signups to. Optional.
    - `id`: Webhook ID
    - `token`: Webhook token
- `etf`: Credentials for student services. **Required.**
    - `username`: Part of your student e-mail address before `@`.
    - `password`: Your password for student services.
- `interval`: Interval of time in which to check for updates. **Required.**

## Running
To run the project, use:
```console
$ npm start
```
