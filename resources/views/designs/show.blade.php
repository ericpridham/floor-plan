@extends('layouts.app')
@section('title', $design->name)
@section('content')
<div class="flex gap-0 -mx-4 sm:-mx-6 lg:-mx-8 -my-8" style="height:calc(100vh - 64px)">

  {{-- Key sidebar --}}
  <aside class="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">Key</h2>
        <p class="text-xs text-gray-400 mt-0.5">{{ $design->name }}</p>
      </div>
      <a href="{{ route('dashboard') }}" class="text-xs text-gray-400 hover:text-gray-600">← Back</a>
    </div>

    {{-- Key entries list --}}
    <div class="flex-1 overflow-y-auto">
      <ul id="keyList" class="divide-y divide-gray-100 text-sm"></ul>
      <div class="px-4 py-2">
        <p id="keyLimitNote" class="text-xs text-amber-600 hidden">Maximum 20 entries reached.</p>
      </div>
    </div>

    {{-- Add entry form --}}
    <div class="border-t border-gray-200 p-4">
      <div id="addEntryForm" class="hidden space-y-2">
        <div class="flex items-center gap-2">
          <input type="color" id="entryColor" value="#6366f1"
            class="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5">
          <input type="text" id="entryLabel" placeholder="Label" maxlength="100"
            class="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
        </div>
        <div class="flex gap-2">
          <button id="saveEntryBtn" class="flex-1 text-xs py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add</button>
          <button id="cancelEntryBtn" type="button" class="flex-1 text-xs py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50">Cancel</button>
        </div>
      </div>
      <button id="addEntryBtn"
        class="w-full text-xs py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Entry
      </button>
    </div>

    {{-- Status --}}
    <div class="px-4 py-2 border-t border-gray-100">
      <p id="saveStatus" class="text-xs text-gray-400">All changes saved</p>
    </div>
  </aside>

  {{-- Canvas area --}}
  <main class="flex-1 overflow-hidden bg-gray-100 relative" id="canvasArea">
    <div id="canvasViewport" class="w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing">
      <div id="canvasContent" class="absolute flex items-start gap-8 p-8" style="transform-origin:top left">
        {{-- Floorplan columns rendered by JS --}}
      </div>
    </div>
    {{-- Zoom controls --}}
    <div class="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
      <button id="zoomIn"  class="w-8 h-8 bg-white rounded-lg shadow border border-gray-200 text-gray-600 text-lg flex items-center justify-center hover:bg-gray-50">+</button>
      <button id="zoomOut" class="w-8 h-8 bg-white rounded-lg shadow border border-gray-200 text-gray-600 text-lg flex items-center justify-center hover:bg-gray-50">−</button>
      <button id="zoomReset" class="w-8 h-8 bg-white rounded-lg shadow border border-gray-200 text-xs text-gray-600 flex items-center justify-center hover:bg-gray-50">1:1</button>
    </div>
    {{-- Paint mode indicator --}}
    <div id="paintBadge" class="absolute top-3 left-3 hidden items-center gap-2 bg-white rounded-lg shadow px-3 py-1.5 border border-indigo-200 z-10">
      <span class="w-3 h-3 rounded-full" id="paintBadgeColor"></span>
      <span class="text-xs font-medium text-indigo-700" id="paintBadgeLabel"></span>
      <span class="text-xs text-gray-400">· click room to paint · Esc to exit</span>
    </div>
  </main>

  {{-- Right: Icon panel --}}
  <aside class="w-56 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col" id="iconPanel">
    <div class="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-900">Icons</h2>
      <div class="flex items-center gap-1">
        <button id="gridModeBtn" class="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 font-medium">Grid</button>
        <button id="freeModeBtn" class="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100">Free</button>
      </div>
    </div>
    <div class="px-2 py-1.5 border-b border-gray-100">
      <input type="text" id="iconSearch" placeholder="Search icons…"
        class="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400">
    </div>
    <div class="flex-1 overflow-y-auto" id="iconListContainer">
      {{-- Populated by JS --}}
    </div>
    {{-- Custom upload --}}
    <div class="border-t border-gray-200 p-2">
      <details class="text-xs">
        <summary class="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">Upload custom icon</summary>
        <div class="mt-2 space-y-1.5" id="uploadIconForm">
          <input type="text" id="customIconLabel" placeholder="Name" maxlength="100"
            class="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
          <input type="text" id="customIconCategory" placeholder="Category" maxlength="50"
            class="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
          <input type="file" id="customIconFile" accept=".svg,.png,image/svg+xml,image/png"
            class="w-full text-xs file:text-xs file:py-0.5 file:px-2 file:rounded file:border-0 file:bg-indigo-50 file:text-indigo-700">
          <button id="uploadIconBtn" class="w-full text-xs py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">Upload</button>
          <p id="uploadIconError" class="text-red-500 hidden"></p>
        </div>
      </details>
    </div>
  </aside>

</div>
@endsection

@push('scripts')
<script>
window.DESIGN_ID      = {{ (int) $design->id }};
window.DESIGN_NAME    = {!! json_encode($design->name, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) !!};
window.STATE_URL      = '{{ route('api.designs.state', $design) }}';
window.KEY_URL        = '{{ route('api.designs.key-entries', $design) }}';
window.HL_URL         = '{{ route('api.designs.highlights', $design) }}';
window.CSRF_TOKEN     = '{{ csrf_token() }}';
window.ICONS_URL      = '{{ route('api.icons.index') }}';
window.ICONS_SYNC_URL = '{{ route('api.designs.icons', $design) }}';
window.ICON_UPLOAD_URL = '{{ route('api.icons.store') }}';
window.ICON_DELETE_URL = '{{ url('api/icons') }}';
</script>
@vite('resources/js/design.js')
@endpush
