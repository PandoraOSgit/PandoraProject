# Pandora OS Design Guidelines

## Design Approach

**Hybrid Approach**: Crypto-native aesthetics inspired by Phantom wallet and Dune Analytics, combined with Material Design's structured component patterns for data-heavy interfaces.

**Core Principle**: Professional enterprise dashboard with cutting-edge crypto visual language - balancing clarity for complex operations with modern glassmorphism aesthetics.

## Typography

**Font Stack**: 
- Primary: Inter (via Google Fonts CDN) - excellent readability for data-dense interfaces
- Monospace: JetBrains Mono - for addresses, transaction hashes, numerical data

**Hierarchy**:
- H1: 2.5rem (40px), font-weight: 700 - page titles
- H2: 2rem (32px), font-weight: 600 - section headers
- H3: 1.5rem (24px), font-weight: 600 - card titles
- Body: 1rem (16px), font-weight: 400 - primary content
- Small: 0.875rem (14px), font-weight: 400 - metadata, timestamps
- Mono: 0.875rem (14px), font-weight: 500 - addresses, hashes

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Tight spacing: p-2, gap-2 (8px) - compact data rows
- Standard spacing: p-4, gap-4 (16px) - cards, form fields
- Section spacing: p-6, gap-6 (24px) - major content blocks
- Page margins: p-8 (32px) - outer containers

**Grid Structure**:
- Main layout: Sidebar (240px fixed) + Main content (flex-1)
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Agent fleet view: grid-cols-1 lg:grid-cols-2 xl:grid-cols-3
- Analytics: Single column with max-w-7xl

## Component Library

### Navigation
**Sidebar**: Fixed left, dark background with purple accent, icons + labels, collapsible on mobile
- Dashboard, Agents, Fleet, Analytics, Settings sections
- Active state: purple gradient background on selected item
- Wallet connection button in sidebar header

### Core Components

**Agent Cards**: Glassmorphism effect with backdrop-blur, rounded-2xl borders
- Header: Agent name, status indicator (active/idle/error)
- Body: Key metrics (transactions, success rate, balance)
- Footer: Action buttons (Edit, Pause, View Details)

**Transaction Monitor**: Real-time feed with timeline visualization
- Left: Timestamp and block number
- Center: Transaction type icon + description
- Right: Status badge (confirmed/pending/failed) + signature link
- Monospace font for signatures

**Analytics Charts**: Dark theme with purple/blue gradients
- Use Recharts with custom purple color scheme
- Smooth curves, subtle grid lines
- Interactive tooltips on hover

**ZK Proof Display**: 
- Visual proof verification indicator (checkmark with glow effect)
- Compact proof data in monospace with copy button
- "Privacy preserved" badge with shield icon

**Fleet Coordination**: 
- Network graph visualization showing agent connections
- Agent nodes with status colors (green/yellow/red)
- Connection lines showing inter-agent communication

### Form Elements
**Input Fields**: Dark background, purple focus ring, rounded-lg borders
**Buttons**: 
- Primary: Purple gradient background (#8B7FFF to #6B5FDD), white text
- Secondary: Transparent with purple border, purple text
- Danger: Red gradient for destructive actions

### Data Tables
- Alternating row backgrounds for readability
- Monospace for numerical/address columns
- Sortable headers with arrow indicators
- Sticky header on scroll

## Images

**Hero Section**: No traditional hero - dashboard launches directly into agent management view

**Agent Avatars**: Generative gradient circles based on agent ID (purple/blue spectrum) - 40px diameter in cards, 64px in detail views

**Empty States**: Illustration of interconnected nodes/circuits in purple/blue when no agents exist

## Glassmorphism Implementation
- Background: rgba(139, 127, 255, 0.05)
- Border: 1px solid rgba(139, 127, 255, 0.2)
- Backdrop-filter: blur(12px)
- Apply to cards, modals, sidebar

## Accessibility
- WCAG AA contrast ratios on all text
- Focus indicators: 2px purple ring on all interactive elements
- Icon-only buttons must have aria-labels
- Screen reader announcements for transaction status changes

## Animations
**Minimal and purposeful only**:
- Sidebar collapse: 200ms ease-in-out
- Transaction status updates: Subtle fade-in (300ms)
- Agent status changes: Glow pulse effect (1s)
- NO scroll animations, NO complex transitions