export const EDIT_PRESETS = {
  vintageFilter: {
    prompt: "Add a retro, vintage filter with warm tones",
    label: "Vintage Filter",
    icon: "📷",
  },
  removeText: {
    prompt: "Remove any obvious watermarks or overlaid text from the image. Preserve text that is part of the original scene, like text on books or signs.",
    label: "Remove Text",
    icon: "🚫",
  },
  blueBg: {
    prompt: "Change the background to solid bright blue, keep the main object",
    label: "Blue Backdrop",
    icon: "🎨",
  },
  sketch: {
    prompt: "Convert to black and white pencil sketch style",
    label: "Pencil Sketch",
    icon: "✏️",
  },
  dramatic: {
    prompt: "Add dramatic, cinematic lighting effect",
    label: "Dramatic Light",
    icon: "✨",
  },
} as const;

export type PresetKey = keyof typeof EDIT_PRESETS;
