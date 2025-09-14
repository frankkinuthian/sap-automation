import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuthClient } from '../../../lib/email/gmail-oauth-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ error: 'Authorization failed' }, { status: 400 });
  }

  if (!code) {
    // Start the authorization flow
    try {
      const gmailClient = new GmailOAuthClient();
      const authUrl = gmailClient.getAuthUrl();
      
      return NextResponse.redirect(authUrl);
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to start authorization',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  }

  try {
    // Exchange code for tokens
    const gmailClient = new GmailOAuthClient();
    await gmailClient.getTokenFromCode(code);

    // Return success HTML page
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Authorization Success</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: green; }
            .button { background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h2 class="success">✅ Gmail Authorization Successful!</h2>
          <p>Your Gmail account has been successfully connected to the SAP automation system.</p>
          <p>You can now close this tab and return to the dashboard to sync emails.</p>
          <a href="/" class="button">Back to Dashboard</a>
        </body>
      </html>
    `;

    return new NextResponse(successHtml, {
      headers: { 'content-type': 'text/html' },
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Authorization Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h2 class="error">❌ Authorization Failed</h2>
          <p>There was an error connecting your Gmail account. Please try again.</p>
          <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
          <a href="/">Back to Dashboard</a>
        </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: { 'content-type': 'text/html' },
    });
  }
}
