// ============================================================
// Selectors for Google Flow (labs.google/fx/tools/flow)
// and Gemini Web (gemini.google.com)
// ============================================================

export const FLOW_URL = "https://labs.google/fx/tools/flow";
export const GEMINI_URL = "https://gemini.google.com";

// Google Login
export const GOOGLE_LOGIN = {
  emailInput: 'input[type="email"]',
  emailNext: '#identifierNext button',
  passwordInput: 'input[type="password"]',
  passwordNext: '#passwordNext button',
  // Sometimes Google shows "Choose an account" screen
  accountChooser: '[data-identifier]',
};

// Flow - Home Page
export const FLOW_HOME = {
  newProjectButton: 'text="New project"',
  projectCard: '[role="listitem"], [data-project-id]',
};

// Flow - Project Editor
export const FLOW_EDITOR = {
  // Main prompt input at bottom
  promptInput: 'textarea, [contenteditable="true"]',
  promptPlaceholder: 'text="What do you want to create?"',

  // Send button (arrow icon at right of input)
  sendButton: 'button[aria-label="Send"], button:has(svg):near(textarea)',

  // Mode selector button ("Video □ x1" / "Image")
  modeButton: 'button:has-text("Video"), button:has-text("Image")',
  videoModeOption: 'text="Video"',
  imageModeOption: 'text="Image"',

  // Model selector (in settings or dropdown)
  modelSelector: 'button:has-text("Model"), [aria-label*="model"]',

  // Nano Banana Pro model option
  nanoBananaOption: 'text="Nano Banana"',
  nanoBanana2Option: 'text="Nano Banana 2"',
  nanoBananaProOption: 'text="Nano Banana Pro"',

  // veo3.1 fast model option
  veo31FastOption: 'text="Veo 3.1"',
  veo31Option: ':text("veo")',

  // "+" button for adding media/uploading images
  addMediaButton: 'button[aria-label="Add"], button:has-text("+")',
  uploadInput: 'input[type="file"]',

  // Generated content area
  mediaGrid: '[role="grid"], [role="list"]',
  generatedImage: 'img[src*="generated"], img[alt*="Generated"]',
  generatedVideo: 'video, [data-video]',

  // Download / save
  downloadButton: 'button[aria-label="Download"], button:has-text("Download")',
  moreOptionsButton: 'button[aria-label="More"], button:has-text("⋮")',

  // Loading / generating state
  loadingSpinner: '[role="progressbar"], .loading',
  generatingIndicator: 'text="Generating"',

  // Error / policy block indicators
  errorMessage: '[role="alert"], text="couldn\'t generate", text="policy"',
  retryButton: 'button:has-text("Retry"), button:has-text("Try again")',

  // Settings panel
  settingsButton: 'button[aria-label="Settings"]',

  // Count selector (x1, x4 etc)
  countSelector: 'button:has-text("x1"), button:has-text("x4")',

  // Back button
  backButton: 'button[aria-label="Back"], a[aria-label="Back"]',
};

// Gemini Web - Chat Interface
export const GEMINI_CHAT = {
  // Chat input
  chatInput: '[contenteditable="true"], textarea[aria-label*="prompt"], .ql-editor, [data-placeholder]',

  // Send button
  sendButton: 'button[aria-label="Send message"], button[data-at="send"], .send-button',

  // Response container - Gemini renders responses in markdown
  responseContainer: '.response-container, .model-response, [data-message-author-role="model"]',
  responseText: '.markdown, .response-text, [data-message-author-role="model"] .message-content',
  lastResponse: '.response-container:last-child, [data-message-author-role="model"]:last-of-type',

  // Loading indicator (Gemini shows dots while generating)
  thinkingIndicator: '.thinking, [aria-label*="loading"], [aria-label*="thinking"]',

  // New chat button
  newChatButton: 'button[aria-label="New chat"], a:has-text("New chat")',

  // Stop generating button
  stopButton: 'button[aria-label="Stop generating"], button:has-text("Stop")',
};

// Timeouts
export const TIMEOUTS = {
  login: 60000,        // 60s for login (may need 2FA)
  navigation: 15000,   // 15s for page navigation
  imageGeneration: 120000,  // 2 min for image generation
  videoGeneration: 600000,  // 10 min for video generation (can be slow)
  promptGeneration: 120000, // 2 min for prompt batch generation
  downloadWait: 30000, // 30s for download to complete
};
