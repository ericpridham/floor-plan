@extends('layouts.app')
@section('title', 'Setup — ' . $floorplan->name)
@section('content')
{{-- full-height two-column layout --}}
<div class="flex gap-0 -mx-4 sm:-mx-6 lg:-mx-8 -my-8" style="height: calc(100vh - 64px)">

  {{-- Left sidebar: room list --}}
  <aside class="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">Rooms</h2>
        <p class="text-xs text-gray-400 mt-0.5"><span id="roomCount">0</span> defined</p>
      </div>
      <a href="{{ route('dashboard') }}" class="text-xs text-gray-400 hover:text-gray-600">← Back</a>
    </div>
    <ul id="roomList" class="flex-1 overflow-y-auto divide-y divide-gray-100 text-sm">
      {{-- populated by JS --}}
    </ul>
    <div class="px-4 py-3 border-t border-gray-200">
      <div id="saveStatus" class="text-xs text-gray-400">All changes saved</div>
    </div>
  </aside>

  {{-- Main canvas area --}}
  <main class="flex-1 overflow-hidden bg-gray-100 relative flex items-center justify-center p-4">
    <div class="text-xs text-gray-400 absolute top-3 left-3 z-10">
      Click and drag to draw a room. Click a room to select. Double-click label to rename.
    </div>

    {{-- Canvas container: image + overlay --}}
    <div id="canvasWrap" class="relative select-none shadow-lg" style="max-width:100%;max-height:100%">
      <img
        id="floorplanImg"
        src="{{ $floorplan->thumbnailUrl() }}"
        alt="{{ $floorplan->name }}"
        class="block max-w-full max-h-full"
        style="max-height: calc(100vh - 130px)"
        draggable="false"
      >
      <div id="roomOverlay" class="absolute inset-0 overflow-hidden cursor-crosshair"></div>
    </div>
  </main>
</div>
@endsection

@push('scripts')
<script>
  window.FLOORPLAN_ID = {{ $floorplan->id }};
  window.INITIAL_ROOMS = {!! json_encode($rooms, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) !!};
  window.ROOMS_SYNC_URL = '{{ route('api.rooms.sync', $floorplan) }}';
  window.CSRF_TOKEN = '{{ csrf_token() }}';
</script>
@vite('resources/js/setup.js')
@endpush
