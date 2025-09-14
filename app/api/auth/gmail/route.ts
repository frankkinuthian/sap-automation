import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuthClient } from '../../../../lib/email/gmail-oauth-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Authorization Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: red; }
            .button { background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h2 class="error">❌ Authorization Denied</h2>
          <p>Gmail authorization was cancelled or failed.</p>
          <p>Error: ${error}</p>
          <a href="/" class="button">Back to Dashboard</a>
        </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 400,
      headers: { 'content-type': 'text/html' },
    });
  }

  if (!code) {
    // Start the authorization flow
    try {
      const gmailClient = new GmailOAuthClient();

      // Check if setup is complete
      if (!gmailClient.isSetupComplete()) {
        const debugInfo = gmailClient.getDebugInfo();

        const setupErrorHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Gmail Setup Required</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                .error { color: red; }
                .debug { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
                .button { background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
              </style>
            </head>
            <body>
              <h2 class="error">❌ Gmail Setup Required</h2>
              <p>Gmail OAuth credentials are not properly configured.</p>

              <h3>Setup Instructions:</h3>
              <ol>
                <li>Download OAuth2 credentials from Google Cloud Console</li>
                <li>Save the file as <code>gmail-credentials.json</code> in the project root</li>
                <li>Ensure the redirect URI is set to: <code>http://localhost:3000/api/auth/gmail</code></li>
              </ol>

              <div class="debug">
                <h4>Debug Information:</h4>
                <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
              </div>

              <a href="/" class="button">Back to Dashboard</a>
            </body>
          </html>
        `;

        return new NextResponse(setupErrorHtml, {
          status: 500,
          headers: { 'content-type': 'text/html' },
        });
      }

      const authUrl = gmailClient.getAuthUrl();
      console.log('Redirecting to Gmail OAuth URL:', authUrl);

      return NextResponse.redirect(authUrl);
    } catch (error) {
      console.error('Failed to start Gmail authorization:', error);

      const startErrorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Gmail Authorization Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { color: red; }
              .button { background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            </style>
          </head>
          <body>
            <h2 class="error">❌ Authorization Setup Failed</h2>
            <p>Failed to start Gmail authorization process.</p>
            <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
            <a href="/" class="button">Back to Dashboard</a>
          </body>
        </html>
      `;

      return new NextResponse(startErrorHtml, {
        status: 500,
        headers: { 'content-type': 'text/html' },
      });
    }
  }

  try {
    // Exchange code for tokens
    console.log('Exchanging authorization code for tokens...');
    const gmailClient = new GmailOAuthClient();
    await gmailClient.getTokenFromCode(code);

    console.log('Gmail authorization successful!');

    // Return success HTML page
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Authorization Success</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              text-align: center;
            }
            .success { color: green; }
            .button {
              background: #4285f4;
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 5px;
              display: inline-block;
              margin-top: 20px;
              font-size: 16px;
            }
            .button:hover { background: #3367d6; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="icon">✅</div>
          <h2 class="success">Gmail Authorization Successful!</h2>
          <p>Your Gmail account has been successfully connected to the SAP automation system.</p>
          <p>You can now close this tab and return to the dashboard to sync emails.</p>
          <a href="/" class="button">Back to Dashboard</a>

          <script>
            // Auto-close after 5 seconds if opened in popup
            if (window.opener) {
              setTimeout(() => {
                window.close();
              }, 3000);
            }
          </script>
        </body>
      </html>
    `;

    return new NextResponse(successHtml, {
      headers: { 'content-type': 'text/html' },
    });
  } catch (error) {
    console.error('Gmail token exchange error:', error);

    const exchangeErrorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Authorization Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: red; }
            .button { background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h2 class="error">❌ Authorization Failed</h2>
          <p>There was an error completing the Gmail authorization process.</p>
          <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
          <p>Please try again or check your Gmail API setup.</p>
          <a href="/api/auth/gmail" class="button">Try Again</a>
          <a href="/" class="button" style="margin-left: 10px;">Back to Dashboard</a>
        </body>
      </html>
    `;

    return new NextResponse(exchangeErrorHtml, {
      status: 500,
      headers: { 'content-type': 'text/html' },
    });
  }
}
