import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

let supabase;

if (!supabaseUrl || !supabaseKey) {
    console.warn('[WARNING] Supabase credentials not found. Database operations will fail.');
    // Create a dummy client that warns when used
    supabase = {
        from: () => ({
            select: () => ({ eq: () => ({ single: async () => ({ error: 'Database not configured' }) }) }),
            insert: () => ({ select: () => ({ single: async () => ({ error: 'Database not configured' }) }) }),
            upsert: () => ({ select: () => ({ single: async () => ({ error: 'Database not configured' }) }) }),
            update: () => ({ eq: () => ({ single: async () => ({ error: 'Database not configured' }) }) })
        })
    };
} else {
    supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase };

// User management
export const getOrCreateUser = async (email, name = null) => {
    try {
        // Try to find existing user
        const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUser) {
            return existingUser;
        }

        // Create new user
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{ email, name }])
            .select()
            .single();

        if (createError) throw createError;
        return newUser;
    } catch (error) {
        console.error('[DB] Error getting/creating user:', error);
        throw error;
    }
};
