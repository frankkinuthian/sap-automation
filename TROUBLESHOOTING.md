# AI Processing Troubleshooting Guide

## Issue: Message parsing success not reflecting in UI

### Quick Diagnosis

Run the debug script to check system status:

```bash
node scripts/debug-ai-processing.js
```

### Common Issues & Solutions

#### 1. Inngest Dev Server Not Running

**Symptoms:**

- "Process with AI" button shows "Start Inngest"
- Error: "Inngest dev server not running"
- Functions trigger but don't execute

**Solution:**

```bash
# Start Inngest dev server
npm run dev:inngest

# Or start both Next.js and Inngest together
npm run dev:all
```

**Verify:** Open http://localhost:8288 to see Inngest dev UI

#### 2. OpenAI API Configuration Issues

**Symptoms:**

- Error: "Cannot read properties of undefined (reading 'request')"
- Functions fail with OpenAI errors

**Solution:**
Check your `.env.local` file has:

```bash
OPENAI_API_KEY=sk-proj-your-actual-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Fixed in latest code:** OpenAI client now properly initialized with API key

#### 3. Message Status Not Updating in UI

**Symptoms:**

- Processing completes but UI still shows old status
- Need to refresh page to see changes

**Solutions:**

a) **Hard refresh the page:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

b) **Check browser console** for errors

c) **Wait a few seconds** - Convex updates can take 1-2 seconds

d) **Check system logs** in the dashboard for processing errors

#### 4. Environment Variables Missing

**Check these are set in `.env.local`:**

```bash
# Required
OPENAI_API_KEY=your-key-here
NEXT_PUBLIC_CONVEX_URL=your-convex-url

# Optional (for development)
INNGEST_EVENT_KEY=local-dev-key
INNGEST_SIGNING_KEY=local-dev-signing-key
```

### Step-by-Step Debugging

1. **Check AI Status API:**

   ```bash
   curl http://localhost:3000/api/ai/status
   ```

2. **Check Inngest Health:**

   ```bash
   curl http://localhost:8288/health
   ```

3. **Trigger Processing Manually:**

   - Go to message detail page
   - Click "Process with AI" button
   - Watch browser console for errors
   - Check Inngest dev UI for function execution

4. **Check System Logs:**
   - Go to Dashboard → System Logs tab
   - Look for recent AI processing logs
   - Check for error messages

### Expected Flow

1. **Message received** → Status: "received"
2. **Click "Process with AI"** → Status: "processing"
3. **AI analysis completes** → Status: "parsed"
4. **UI updates** → Shows AI analysis data

### Verification Steps

After processing a message, you should see:

- ✅ Message status changes to "parsed"
- ✅ AI Analysis section shows extracted data
- ✅ Confidence score and classification
- ✅ Customer information extracted
- ✅ Products/items identified
- ✅ Business context analyzed

### Still Having Issues?

1. **Restart everything:**

   ```bash
   # Stop all processes
   # Then restart
   npm run dev:all
   ```

2. **Check the latest system logs** in the dashboard

3. **Look at browser console** for JavaScript errors

4. **Verify Convex connection** - check if other data loads properly

5. **Test with a simple message** - try processing a basic email first

### Development Commands

```bash
# Start Next.js only
npm run dev

# Start Inngest only
npm run dev:inngest

# Start both together
npm run dev:all

# Debug AI processing
node scripts/debug-ai-processing.js
```
