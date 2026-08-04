const postgres = require('./postgres');
const mysql = require('./mysql');
const firebase = require('./firebase');
const sqlite = require('./sqlite');

const adapters = {
  postgres,
  mysql,
  firebase,
  sqlite
};

function getAdapter(type) {
  const adapter = adapters[type];
  if (!adapter) {
    throw new Error(`Unsupported database type: ${type}`);
  }
  return adapter;
}

module.exports = { getAdapter };
