# Helper App — תזכורת

PWA בעברית למבוגרים: ניהול תרופות, בדיקות (לחץ דם וכו') ואימונים — לעצמם ולבני המשפחה שלהם.

## Stack
- Next.js 16 (App Router, Turbopack)
- Supabase (Postgres + Auth + RLS)
- Web Push (VAPID) + Service Worker
- TypeScript + Tailwind v4

## Pages
- `/signup` — בחירת תפקיד (מטופל/בן משפחה) + יצירת חשבון
- `/login` — כניסה (אימייל + סיסמא; מינימום 6 תווים)
- `/today` — מסך הבית: רשימת המשימות של היום עם סימון "בוצע"
- `/schedules` — ניהול תזכורות (תרופות, בדיקות, אימונים)
- `/family` — ניהול בני משפחה (מנהל / עורך / צופה)
- `/invite/[token]` — קישור הזמנה
- `/settings` — הגדרות + שינוי סיסמא

## API
**פנימי (משתמש מחובר):**
- `POST /api/schedules` / `PATCH|DELETE /api/schedules/[id]`
- `POST /api/occurrences/[id]/mark` — סימון בוצע/דלג/החזרה
- `POST /api/reminders/push` — תזכר עכשיו (בן משפחה לוחץ)
- `POST /api/push/subscribe` — רישום מנוי Web Push
- `POST /api/family/invitations` / `PATCH|DELETE /api/family/members`

**Cron (n8n / pg_cron) — דורש `x-cron-secret`:**
- `POST /api/internal/cron/dispatch` — שולח push לתזכורות שמועדן הגיע, מסמן missed, מאריך חלון

**External integration — דורש `Authorization: Bearer <api_token>`:**
- `POST /api/external/push` — `scope: push:send`
- `POST /api/external/occurrences/mark` — `scope: occurrences:write`
- `GET /api/external/patients/[id]/status` — `scope: patients:read`

יצירת טוקנים: insert ב-`api_tokens` ידנית עם `token_hash = sha256(<raw>)`.

## Development

```bash
cp .env.example .env.local   # מילוי הערכים
npm install
npm run dev
```

המיגרציות מנוהלות ע״י Supabase CLI:
```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## Push Notifications
- VAPID keys ב-env.
- iOS: דורש "הוספה למסך הבית" (iOS 16.4+).
- ה-Service Worker ב-`public/sw.js` תומך ב-action buttons "בוצע" / "דלג" שמסמנים את ה-occurrence ישירות מההתראה.

## n8n cron
Workflow פשוט על ה-VPS: Schedule Trigger כל דקה → HTTP Request:
```
POST https://<your-domain>/api/internal/cron/dispatch
Headers: x-cron-secret: <CRON_SECRET>
```

## RLS Model
- `patient` רואה רק את עצמו ואת בני המשפחה שלו.
- `patient_members.role` קובע גישה: `admin` > `editor` > `viewer`.
- `viewer` קריאה בלבד.
- ל-`patient_members` ו-`invitations` יש מדיניות כתיבה ל-`admin` או למטופל עצמו בלבד.

## Known Gaps (MVP)
- אין email/SMS — הזמנות מועברות כקישור שצריך להעתיק ידנית.
- אין גרפים להיסטוריית לחץ דם (יבוא בפעימה הבאה).
- אין אריזת תרופה (inventory).
- אין phone auth — רק email + password.
