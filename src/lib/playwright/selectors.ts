// ============================================================
// Flow Website Selectors
// Centralized selectors for the flow website automation.
// Update these when the flow site changes its DOM structure.
// ============================================================

// TODO: Fill in actual selectors after user provides flow site details
export const FLOW_SELECTORS = {
  // Login
  loginUrl: "", // Will be filled in
  usernameInput: "",
  passwordInput: "",
  loginButton: "",

  // Chat / Prompt Generation
  chatUrl: "",
  chatInput: "textarea", // Chat message input
  sendButton: "", // Send message button
  responseContainer: "", // Where AI response appears
  responseText: "", // The actual text content of the response

  // Image Generation (Nano Banana Pro)
  imageGenUrl: "",
  imageModelSelector: "",
  imagePromptInput: "",
  imageGenerateButton: "",
  imageResult: "", // Generated image element
  imageDownloadButton: "",

  // Video Generation (veo3.1 fast)
  videoGenUrl: "",
  videoModelSelector: "",
  videoImageUpload: "", // Upload source image input
  videoPromptInput: "",
  videoGenerateButton: "",
  videoResult: "", // Generated video element
  videoDownloadButton: "",

  // Error indicators
  errorMessage: "", // Content policy or generation error
  rateLimitMessage: "",
};
