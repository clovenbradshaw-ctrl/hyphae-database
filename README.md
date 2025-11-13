# Hyphae Network E2EE Client

A fully-featured Matrix client with end-to-end encryption support for the Hyphae Network (hyphae.social).

## Features

- ✅ **Full End-to-End Encryption** using Rust crypto (matrix-sdk-crypto WASM)
- ✅ Connect to hyphae.social
- ✅ View all your rooms
- ✅ Send and receive encrypted messages
- ✅ Real-time message updates
- ✅ Encryption indicators (🔒 on encrypted rooms and messages)
- ✅ Local key storage in IndexedDB
- ✅ Cross-signing support

## Setup

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn

### Installation

1. **Navigate to the project directory:**
   ```bash
   cd hyphae-e2ee-client
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   The app will automatically open at `http://localhost:3000`

### Building for Production

To create a production build:

```bash
npm run build
```

The build output is written to the `docs/` directory (ignored by git) so you can publish it with GitHub Pages or any static file server by running `npm run build` and copying the generated files from `docs/`.

## Usage

1. Enter your username (e.g., `michael` or `@michael:hyphae.social`)
2. Enter your password
3. Click "Connect to Hyphae"
4. Wait for encryption to initialize
5. Select a room from the list
6. Send encrypted messages!

## How Encryption Works

- **Rust Crypto**: Uses matrix-sdk-crypto (WASM) for robust E2EE
- **Key Storage**: Encryption keys stored locally in your browser's IndexedDB
- **Device ID**: Each browser session gets a unique device ID
- **Cross-Signing**: Automatically sets up cross-signing for device verification
- **Encrypted Rooms**: Rooms with encryption show a 🔒 indicator
- **Encrypted Messages**: Individual encrypted messages show a 🔒 badge

## Security Notes

- Your encryption keys never leave your device
- Keys are stored in IndexedDB (browser local storage)
- Each device has its own encryption keys
- Messages are encrypted end-to-end before being sent to the server
- The server only sees encrypted content

## Troubleshooting

### "Failed to initialize crypto"
- Make sure you're using a modern browser (Chrome, Firefox, Safari, Edge)
- Ensure IndexedDB is enabled in your browser
- Try clearing your browser cache and reloading

### "Unable to decrypt"
- This can happen if you're using a new device
- You may need to verify your device with another logged-in device
- Or bootstrap your encryption keys again

### Network Issues
- Check that you can access https://hyphae.social
- Verify your firewall isn't blocking WebSocket connections

## Technical Details

### Dependencies

- **matrix-js-sdk**: Matrix client-server SDK
- **webpack**: Module bundler
- **@matrix-org/matrix-sdk-crypto-wasm**: Rust crypto implementation (included with matrix-js-sdk)

### Architecture

```
docs/               # Production build artifacts (generated on demand)
src/
  └── index.js      # Application logic with E2EE
index.html          # Main HTML template copied into the build
webpack.config.js   # Webpack configuration
package.json        # Dependencies and scripts
```

### Key Files

- **webpack.config.js**: Configured to handle WASM files and copy crypto assets
- **src/index.js**: Main application logic including:
  - Login flow
  - Encryption initialization (`initRustCrypto()`)
  - Cross-signing setup
  - Message encryption/decryption
  - Real-time sync

## For Developers

### Adding Features

The client is built with vanilla JavaScript and can be easily extended:

- Add room creation/joining features
- Implement file uploads (encrypted)
- Add device verification UI
- Implement key backup
- Add typing indicators
- Create custom room views (database-like interface)

### Custom Event Types

You can send custom event types for database-like functionality:

```javascript
await client.sendEvent(roomId, 'com.hyphae.data.record', {
    table: 'investigations',
    data: {
        title: 'Nashville Housing Investigation',
        status: 'active'
    }
});
```

## License

ISC

## Support

For issues specific to Hyphae Network, contact your server administrator.
For Matrix protocol questions, see: https://matrix.org/docs/
