const postgres = require('./postgres');
const mysql = require('./mysql');
const firebase = require('./firebase');
const sqlite = require('./sqlite');
const mongodb = require('./mongodb');
const supabase = require('./supabase');

const adapters = {
  postgres,
  mysql,
  firebase,
  sqlite,
  mongodb,
  supabase
};

function getAdapter(type) {
  const adapter = adapters[type];
  if (!adapter) {
    throw new Error(`Unsupported database type: ${type}`);
  }
  return adapter;
}

module.exports = { getAdapter };
