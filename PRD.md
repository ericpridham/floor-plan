# Floorplan Design Tool — Product Requirements Document

## Overview

A web application that allows authenticated users to upload floorplan images, define
named rooms by drawing rectangles, and create annotated designs on top of those
floorplans using color highlights and icons. Designs can be saved, reloaded, and
exported as PNG images.

**Tech stack:** PHP backend, vanilla JavaScript frontend, server-side data persistence.

---

## Phase 1: Foundation & Authentication

### Goal
Establish the project infrastructure, database schema, and user account system.

### Features

#### 1.1 User Registration
- Registration form: email, password, password confirmation
- Server-side validation: unique email, password minimum length (8 chars), passwords match
- Passwords stored as bcrypt hashes
- On success: auto-login and redirect to dashboard
- On failure: inline error messages

#### 1.2 User Login / Logout
- Login form: email, password
- PHP session-based authentication
- "Remember me" checkbox (30-day persistent cookie)
- Logout clears session and redirects to login page
- All authenticated routes redirect unauthenticated users to login

#### 1.3 Database Schema (initial tables)
- `users`: id, email, password_hash, created_at, updated_at
- `floorplans`: id, user_id, name, image_path, width_px, height_px, created_at, updated_at
- `rooms`: id, floorplan_id, name, x, y, width, height, created_at, updated_at
- `designs`: id, user_id, name, created_at, updated_at
- `design_floorplans`: id, design_id, floorplan_id, canvas_x (for side-by-side positioning)
- `design_key_entries`: id, design_id, color_hex, label, sort_order
- `design_room_highlights`: id, design_id, room_id, key_entry_id
- `icon_library`: id, user_id (nullable for built-in), category, label, svg_path
- `design_icons`: id, design_id, icon_library_id, x, y, width, height, rotation, is_free_placed

#### 1.4 Application Shell
- Responsive layout: top navigation bar, main content area
- Navigation: Logo/home, Dashboard link, account menu (logout)
- Protected route middleware for all pages except login/register
- Basic CSS design system (colors, typography, spacing, button styles, form styles)

### Acceptance Criteria
- User can register, log in, and log out
- Unauthenticated users are redirected to login
- Database tables are created via migration scripts

---

## Phase 2: Floorplan Upload & Management

### Goal
Allow users to upload floorplan images and manage their library of floorplans.

### Features

#### 2.1 Upload Floorplan
- Upload form: image file (PNG, JPEG, WebP, max 20MB), floorplan name
- Server validates file type and size
- Image stored on server in a user-scoped directory (e.g. `uploads/{user_id}/floorplans/`)
- Record image natural dimensions (width_px, height_px) at upload time
- Redirect to floorplan setup mode after successful upload

#### 2.2 Floorplan Dashboard
- Grid/list view of all user's floorplans
- Each card shows: thumbnail, name, room count, date uploaded
- Actions per floorplan: Open (setup mode), Rename, Delete
- Empty state message when no floorplans exist

#### 2.3 Rename Floorplan
- Inline rename or modal form
- Validates: non-empty, max 100 characters

#### 2.4 Delete Floorplan
- Confirmation dialog before deletion
- Deletes image file from server and all associated DB records (rooms, design references)
- Warns user if the floorplan is used in any saved designs

### Acceptance Criteria
- User can upload an image and see it in their dashboard
- User can rename and delete floorplans
- Invalid uploads (wrong type, too large) show an error message

---

## Phase 3: Floorplan Setup Mode (Room Definition)

### Goal
Allow users to draw and name rectangular room regions on top of their floorplan image.

### Features

#### 3.1 Setup Canvas
- Display the uploaded floorplan image as a background on an HTML canvas (or
  positioned `<div>` overlay)
- Canvas scales to fit the viewport while maintaining aspect ratio
- All room coordinates stored as percentages of image dimensions (for resolution
  independence)

#### 3.2 Draw Room Rectangles
- Click-and-drag to draw a new rectangle over a room area
- Drawn rectangle is shown with a dashed border and semi-transparent overlay
  while drawing
- After releasing the mouse, a name prompt appears (inline label input on the
  rectangle, or small popup)
- User types the room name and presses Enter or clicks a confirm button to save

#### 3.3 Edit Existing Rooms
- Clicking an existing room rectangle selects it (shows resize handles at corners
  and edges)
- Selected room can be:
  - Moved by dragging
  - Resized by dragging handles
  - Renamed by double-clicking the label
  - Deleted via a small delete button (×) that appears on selection or via keyboard
    Delete key

#### 3.4 Room List Panel
- Sidebar panel lists all named rooms for the current floorplan
- Clicking a room in the list selects/highlights it on the canvas
- Room count shown in panel header

#### 3.5 Save Room Definitions
- "Save" button persists all room rectangles and names to the database
- Auto-save on every add/edit/delete operation (with debounce, 500ms)
- Unsaved-changes indicator if auto-save is disabled or pending

### Acceptance Criteria
- User can draw, name, move, resize, and delete room rectangles
- Room definitions persist across page reloads
- Rooms are stored as percentage-based coordinates

---

## Phase 4: Design Management

### Goal
Allow users to create named designs that combine one or more of their floorplans,
and save/load those designs.

### Features

#### 4.1 Create New Design
- "New Design" button on dashboard
- Step 1: Enter a design name
- Step 2: Select one or more floorplans from the user's library (checkbox list with
  thumbnails)
- Minimum 1 floorplan must be selected
- Creates design record and redirects to design mode

#### 4.2 Design Dashboard
- Separate tab or section on the dashboard listing all saved designs
- Each card shows: design name, floorplan count, last modified date
- Actions: Open (design mode), Rename, Delete

#### 4.3 Rename / Delete Design
- Rename: same inline or modal pattern as floorplans
- Delete: confirmation dialog, deletes all associated design data

#### 4.4 Load Design
- Opening a saved design restores the full canvas state: floorplan layout,
  key entries, room highlights, and icon placements
- Most-recently-modified design shown first in the list

### Acceptance Criteria
- User can create a design selecting 1+ floorplans
- User can rename and delete designs
- User can re-open a saved design and see all previously saved state

---

## Phase 5: Design Canvas, Key & Room Highlighting

### Goal
Render selected floorplans side by side on the design canvas, let users build a
color key, and apply highlight colors to rooms.

### Features

#### 5.1 Design Canvas Layout
- Selected floorplans rendered side by side horizontally, scaled to fit the
  viewport height with a gutter between them
- A label showing the floorplan name appears above each floorplan on the canvas
- Canvas is pannable (click-drag on empty areas) and zoomable (scroll wheel)

#### 5.2 Key Panel
- Sidebar panel titled "Key"
- "Add Entry" button: opens a small form with:
  - Color picker (native `<input type="color">`)
  - Label text field
  - Save / Cancel buttons
- Key entries displayed as a list: color swatch, label text, edit (pencil) and
  delete (×) buttons
- Key entries can be reordered via drag-and-drop
- Maximum 20 key entries per design

#### 5.3 Apply Color to Room
- When a key entry is selected in the Key panel, the cursor changes to indicate
  "paint" mode
- Clicking a room rectangle on the canvas applies that key entry's color as a
  semi-transparent fill (opacity: 50%) overlaid on the room
- A room can only have one color at a time; applying a new color replaces the
  previous one
- Clicking the room again while the same key entry is active removes the highlight
  (toggle off)
- Clicking an empty area or pressing Escape exits paint mode
- Each highlighted room shows a small color swatch badge in its corner matching
  the key entry

#### 5.4 Design Auto-Save
- Design state (key entries, highlights) is auto-saved to the server on every
  change with a 1-second debounce
- A subtle "Saved" / "Saving…" / "Unsaved changes" indicator in the top bar

### Acceptance Criteria
- Multiple floorplans appear side by side
- User can create, edit, reorder, and delete key entries
- Applying a color to a room shows a semi-transparent fill
- Highlights persist after page reload

---

## Phase 6: Icon Library & Placement

### Goal
Allow users to place furniture and fixture icons on the design canvas, with snap-to-grid
or free placement.

### Features

#### 6.1 Pre-built Icon Library
Icons are served as SVG files bundled with the application.

Categories and icons at launch:
- **Furniture:** Chair, Armchair, Sofa, Loveseat, Dining Table, Coffee Table, Bed
  (Single), Bed (Double), Bed (Queen/King), Bookshelf, Wardrobe, Dresser, Nightstand
- **Appliances:** Refrigerator, Stove/Range, Microwave, Dishwasher, Washing Machine,
  Dryer
- **Fixtures:** Toilet, Sink (bathroom), Sink (kitchen), Bathtub, Shower, Vanity
- **Office:** Desk, Office Chair, Monitor, Filing Cabinet, Whiteboard, Bookcase

#### 6.2 User-Uploaded Custom Icons
- "Upload Icon" button in the icon panel
- Accepts SVG or PNG files, max 1MB
- User assigns a name and selects a category (or creates a custom category)
- Uploaded icons appear in an "My Icons" section of the icon panel
- User can delete their custom icons (with warning if icon is used in any design)

#### 6.3 Icon Panel
- Collapsible sidebar panel titled "Icons"
- Icons organized by category tabs or collapsible sections
- Icons displayed as a grid of labeled thumbnails
- Search/filter field to find icons by name
- "My Icons" section at the top for user-uploaded icons

#### 6.4 Placing Icons on the Canvas
- Drag an icon from the panel onto the canvas to place it
- Alternatively, click an icon to select it then click on the canvas to place it
- Placed icons are rendered as SVG/PNG overlays on the canvas

#### 6.5 Grid Mode vs. Free Mode
- Toggle button in the toolbar: "Grid" / "Free" (default: Grid)
- **Grid mode:** A configurable grid is overlaid on each floorplan (default cell size:
  24px at 100% zoom). Dragged/placed icons snap to the nearest grid cell.
  - Grid cell size configurable via a dropdown (e.g. Small / Medium / Large)
  - Grid lines rendered as subtle dots or lines on the canvas
- **Free mode:** Icons can be placed at any pixel position; no snapping
- Mode toggle applies globally to all icon operations for the current session

#### 6.6 Manipulating Placed Icons
- Click a placed icon to select it (shows a selection box with handles)
- **Move:** drag the icon to a new position (respects current grid/free mode)
- **Resize:** drag corner handles (maintains aspect ratio by default; shift-drag
  to resize freely)
- **Rotate:** a rotation handle appears above the selection box; drag to rotate
  in 15° increments in grid mode, freely in free mode
- **Delete:** Delete key or a × button on the selection box
- **Duplicate:** Ctrl+D or a duplicate button on the selection box

#### 6.7 Icon Z-order
- Newly placed icons appear above existing icons
- Right-click context menu on a selected icon: "Bring Forward", "Send Backward",
  "Bring to Front", "Send to Back"

#### 6.8 Design Auto-Save
- Icon placements are included in the auto-save from Phase 5

### Acceptance Criteria
- Pre-built icons are available in all four categories
- User can upload a custom SVG/PNG icon
- Icons can be placed, moved, resized, rotated, and deleted
- Grid snap and free placement modes work correctly

---

## Phase 7: PNG Export

### Goal
Allow users to export the current design canvas as a PNG image that includes the
floorplan, all room highlights, all placed icons, and the color/label key.

### Features

#### 7.1 Export Button
- "Export PNG" button in the top toolbar
- Triggers server-side or client-side canvas rendering

#### 7.2 Export Layout
The exported image contains two regions arranged side by side:
1. **Canvas region:** the full design canvas at a fixed output resolution (2× the
   display resolution, e.g. if display canvas is 1200×800px, export is 2400×1600px)
   - Floorplan images at full quality
   - Semi-transparent room highlight fills
   - All placed icons at their current positions and sizes
2. **Legend region:** a vertical panel appended to the right of the canvas
   - Title: "Key"
   - Each key entry rendered as a color swatch (24×24px) followed by its label text
   - Each icon used in the design rendered as a small thumbnail followed by its label

#### 7.3 Export Resolution & Quality
- Output PNG uses lossless compression
- Minimum exported canvas width: 1200px (scales up smaller canvases)
- Maximum exported canvas width: 4000px (scales down very large canvases)

#### 7.4 Client-Side Rendering
- Export is performed in the browser using the HTML Canvas API (`canvas.toDataURL`)
- A loading spinner is shown during render
- Browser triggers a file download: `{design-name}.png`

#### 7.5 File Naming
- Default filename: slugified design name + date, e.g. `living-room-plan-2026-02-25.png`
- User can edit the filename in a dialog before downloading

### Acceptance Criteria
- Clicking Export PNG downloads a file
- The exported image includes the floorplan image, highlights, icons, and legend
- The legend is always present in the exported image
- Filename defaults to a slugified version of the design name

---

## Non-functional Requirements

| Requirement | Detail |
|---|---|
| Browser support | Latest 2 versions of Chrome, Firefox, Safari, Edge |
| Image upload max | 20MB per floorplan image |
| Custom icon upload max | 1MB per icon |
| Session timeout | 24 hours of inactivity |
| Data isolation | Users can only access their own floorplans and designs |
| Input sanitization | All user-supplied strings sanitized before DB insertion and HTML output |

---

## Out of Scope (v1)

- Real-time collaboration or shared designs
- PDF or SVG export
- Undo/redo history
- Mobile/touch support (desktop browsers only for v1)
- Floorplan scale calibration (real-world measurements)
- Room area calculations
- Email notifications
