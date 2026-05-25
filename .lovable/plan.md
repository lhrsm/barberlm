I will upgrade the time slot selection UI to a premium, modern design with the following improvements:

### UI/UX Enhancements
- **Modern Slot Cards**: Replace the simple buttons with interactive chips using a deep dark theme (`bg-zinc-900`).
- **Enhanced Interactions**: 
    - **Hover**: Subtle scaling (1.05x), border highlight using the shop's primary color, and a soft glow effect.
    - **Selection**: High-contrast state using the primary color, strong shadow glow, and an added "Check" icon for visual confirmation.
    - **Disabled/Taken Slots**: Clear visual cues with lower opacity and appropriate cursors.
- **Micro-animations**: Smooth transitions using Framer Motion for tap and hover states.
- **Mobile Optimization**: Optimized grid spacing and button sizing (minimum 48px height) for better touch interaction.

### Technical Implementation
- Update the `availableTimes.map` section in `src/routes/$slug.tsx`.
- Use the shop's dynamic `primaryColor` for consistent branding in selection states.
- Implement a responsive grid (`grid-cols-3` to `grid-cols-4`) with modern gap spacing.
- Ensure proper accessibility with semantic buttons and clear active states.
