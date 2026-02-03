# Debug Notes - 2026-02-02

## Issue
App not loading properly on iPhone Safari (loknlod.github.io/hbm-resonance)
- Splash screen shows briefly then gets stuck
- No buttons/navigation visible
- Swipe gestures not working

## Attempted Fixes
1. Added splash screen transition logic
2. Added onboarding navigation (swipe, skip, dots)
3. Bypassed all intro screens - go straight to home

## Next Steps (2026-02-03)
- Test on Mac Studio with Safari Dev Tools
- Check browser console for JavaScript errors
- Verify all DOM elements are loading
- May need to add more defensive null checks
- Consider adding error boundary/fallback UI

## Current Status
- Code deployed to GitHub Pages
- Local copy in iCloud Drive/Keats/hbm-resonance
- All features implemented (2,783 lines)
- Needs browser debugging session
