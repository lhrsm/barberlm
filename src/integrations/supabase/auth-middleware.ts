import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env['SUPABASE_URL']
    const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY']

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return next()
    }
    
    const request = getRequest()
    const authHeader = request?.headers?.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseClient = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const { data, error } = await supabaseClient.auth.getClaims(token)
    if (error || !data?.claims) {
      return next()
    }

    return next({
      context: {
        supabase: supabaseClient,
        userId: data.claims.sub,
        claims: data.claims,
      },
    })
  }
)


