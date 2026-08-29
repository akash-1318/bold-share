import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const supabase = createSupabaseServerClient(context.request, context.cookies);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    context.locals.user = user;
  } catch (error) {
    console.error('Auth middleware error:', error);
    context.locals.user = null;
  }

  return next();
});
