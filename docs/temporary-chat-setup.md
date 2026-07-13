# Temporary editor chat setup

The web app already contains the chat interface and Supabase client integration. One database script is required before messages can be sent.

1. Open the Supabase project used by the Vercel deployment.
2. Open **SQL Editor** and create a new query.
3. Paste the full contents of [`supabase/temporary-chat.sql`](../supabase/temporary-chat.sql) and run it.
4. Redeploy Vercel only if the existing deployment does not already have `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Open the deployed editor in two browser windows and confirm messages appear in both.

The script creates a public, plain-text-only temporary channel. Messages:

- are limited to 280 characters;
- reject links in both the browser and database;
- are rate-limited to one send every three seconds per browser;
- are only readable for eight minutes;
- are permanently deleted by Supabase Cron every minute.

If the modal says that setup is required, confirm the script completed and that `temporary_chat_messages` appears under **Database > Tables** with Realtime enabled.
