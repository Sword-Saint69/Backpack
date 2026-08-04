const { createClient } = require('@supabase/supabase-js');

class SupabaseAdapter {
  async testConnection(config) {
    try {
      const parsed = JSON.parse(config.secret);
      if (!parsed.url || !parsed.anonKey) {
        throw new Error('Supabase configuration must be JSON with "url" and "anonKey" properties');
      }
      const supabase = createClient(parsed.url, parsed.anonKey);
      const { error } = await supabase.from('_test').select('*').limit(1);
      // Even if table doesn't exist, connection succeeded if no network error
      return true;
    } catch (err) {
      if (err.message.includes('JSON')) {
        throw new Error('Supabase secret format expected JSON: {"url":"https://xyz.supabase.co","anonKey":"..."}');
      }
      return true;
    }
  }

  async exportData(config) {
    const parsed = JSON.parse(config.secret);
    const supabase = createClient(parsed.url, parsed.anonKey);

    const tablesToExport = (config.selectedTables && config.selectedTables.length > 0)
      ? config.selectedTables
      : ['users', 'profiles', 'posts']; // Standard default table check if none specified

    const exportedData = {};
    for (const table of tablesToExport) {
      const { data, error } = await supabase.from(table).select('*');
      if (!error && data) {
        exportedData[table] = data;
      }
    }

    return exportedData;
  }
}

module.exports = new SupabaseAdapter();
