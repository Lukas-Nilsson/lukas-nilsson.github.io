/**
 * iMessage Reply — Send messages via AppleScript
 *
 * Uses osascript to send iMessages through Messages.app.
 * Supports both individual and group chats.
 *
 * Usage:
 *   npx tsx scripts/imessage-reply.ts "+61400000000" "Hello!"
 *   npx tsx scripts/imessage-reply.ts --chat "chat123456" "Hello group!"
 */

import { execSync } from 'child_process';

/**
 * Send an iMessage to a specific handle (phone number or email).
 */
export function sendMessage(handle: string, text: string): void {
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedHandle = handle.replace(/"/g, '\\"');

    const script = `
        tell application "Messages"
            set targetService to 1st account whose service type = iMessage
            set targetBuddy to participant "${escapedHandle}" of targetService
            send "${escapedText}" to targetBuddy
        end tell
    `;

    try {
        execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
            stdio: 'pipe',
            timeout: 10000,
        });
    } catch {
        // Fallback: try the simpler 'send to buddy' syntax
        const fallbackScript = `tell application "Messages" to send "${escapedText}" to buddy "${escapedHandle}" of (1st account whose service type = iMessage)`;
        execSync(`osascript -e '${fallbackScript.replace(/'/g, "'\\''")}'`, {
            stdio: 'pipe',
            timeout: 10000,
        });
    }
}

/**
 * Send a message to a group chat by chat identifier.
 */
export function sendGroupMessage(chatIdentifier: string, text: string): void {
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedChat = chatIdentifier.replace(/"/g, '\\"');

    const script = `
        tell application "Messages"
            set targetChat to chat "${escapedChat}"
            send "${escapedText}" to targetChat
        end tell
    `;

    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
        stdio: 'pipe',
        timeout: 10000,
    });
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage:');
        console.log('  npx tsx scripts/imessage-reply.ts <handle> <message>');
        console.log('  npx tsx scripts/imessage-reply.ts --chat <chat_id> <message>');
        process.exit(1);
    }

    if (args[0] === '--chat') {
        if (args.length < 3) {
            console.error('Missing chat ID or message');
            process.exit(1);
        }
        const chatId = args[1];
        const message = args.slice(2).join(' ');
        console.log(`📤 Sending to group ${chatId}...`);
        sendGroupMessage(chatId, message);
        console.log('✅ Sent.');
    } else {
        const handle = args[0];
        const message = args.slice(1).join(' ');
        console.log(`📤 Sending to ${handle}...`);
        sendMessage(handle, message);
        console.log('✅ Sent.');
    }
}

main().catch(err => {
    console.error('❌ Error:', err.message ?? err);
    process.exit(1);
});
