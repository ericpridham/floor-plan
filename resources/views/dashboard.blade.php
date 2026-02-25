@extends('layouts.app')

@section('title', 'Dashboard')

@section('content')
<div class="mb-8 flex items-center justify-between">
    <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="mt-1 text-sm text-gray-500">{{ Auth::user()->email }}</p>
    </div>
</div>

{{-- Floorplans --}}
<section class="mb-10">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Floorplans <span class="ml-1 text-sm font-normal text-gray-400">({{ $floorplans->count() }})</span></h2>
        <a href="{{ route('floorplans.create') }}" class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Upload Floorplan
        </a>
    </div>

    @if ($floorplans->isEmpty())
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
            <svg class="mx-auto mb-3 w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-sm font-medium">No floorplans yet</p>
            <p class="text-xs mt-1">Upload a floorplan image to get started.</p>
            <a href="{{ route('floorplans.create') }}" class="mt-4 inline-block text-sm text-indigo-600 font-medium hover:underline">Upload your first floorplan →</a>
        </div>
    @else
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            @foreach ($floorplans as $floorplan)
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {{-- Thumbnail --}}
                <div class="aspect-video bg-gray-100 overflow-hidden">
                    <img
                        src="{{ $floorplan->thumbnailUrl() }}"
                        alt="{{ $floorplan->name }}"
                        class="w-full h-full object-cover"
                        onerror="this.style.display='none'"
                    >
                </div>

                {{-- Info --}}
                <div class="p-4 flex flex-col flex-1">
                    <h3 class="font-medium text-gray-900 text-sm truncate" title="{{ $floorplan->name }}">{{ $floorplan->name }}</h3>
                    <p class="text-xs text-gray-400 mt-0.5">
                        {{ $floorplan->rooms_count }} {{ $floorplan->rooms_count === 1 ? 'room' : 'rooms' }} ·
                        {{ $floorplan->created_at->format('M j, Y') }}
                    </p>

                    {{-- Actions --}}
                    <div class="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                        <span
                            class="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-400 rounded-md cursor-not-allowed"
                            title="Room setup available in the next phase"
                        >Setup</span>

                        <button
                            type="button"
                            data-floorplan-id="{{ $floorplan->id }}"
                            data-floorplan-name="{{ $floorplan->name }}"
                            onclick="openRenameModal(this)"
                            class="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                        >Rename</button>

                        <form
                            method="POST"
                            action="{{ route('floorplans.destroy', $floorplan) }}"
                            class="ml-auto"
                            onsubmit="return confirmDelete(event, {{ (int) $floorplan->designs_count }})"
                        >
                            @csrf
                            @method('DELETE')
                            <button type="submit" class="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">Delete</button>
                        </form>
                    </div>
                </div>
            </div>
            @endforeach
        </div>
    @endif
</section>

{{-- Designs --}}
<section>
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Designs</h2>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
        <svg class="mx-auto mb-3 w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
        <p class="text-sm font-medium">No designs yet</p>
        <p class="text-xs mt-1">Create a design once you have floorplans.</p>
    </div>
</section>

{{-- Rename Modal --}}
<div id="renameModal" class="fixed inset-0 z-50 hidden flex items-center justify-center">
    <div class="absolute inset-0 bg-black/40" onclick="closeRenameModal()"></div>
    <div class="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 class="text-base font-semibold text-gray-900 mb-4">Rename Floorplan</h3>
        <form id="renameForm" method="POST" action="">
            @csrf
            @method('PATCH')
            <input
                type="text"
                id="renameInput"
                name="name"
                required
                maxlength="100"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
            >
            <div class="flex gap-3 justify-end">
                <button type="button" onclick="closeRenameModal()" class="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" class="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save</button>
            </div>
        </form>
    </div>
</div>

@push('scripts')
<script>
function openRenameModal(btn) {
    const id = btn.dataset.floorplanId;
    const name = btn.dataset.floorplanName;
    const base = '{{ url('/floorplans') }}';
    document.getElementById('renameForm').action = base + '/' + id;
    document.getElementById('renameInput').value = name;
    document.getElementById('renameModal').classList.remove('hidden');
    document.getElementById('renameInput').focus();
    document.getElementById('renameInput').select();
}

function closeRenameModal() {
    document.getElementById('renameModal').classList.add('hidden');
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeRenameModal();
});

function confirmDelete(event, designsCount) {
    let msg = 'Are you sure you want to delete this floorplan? This cannot be undone.';
    if (designsCount > 0) {
        msg = 'Warning: This floorplan is used in ' + designsCount + ' design(s). Deleting it will remove it from those designs.\n\n' + msg;
    }
    return confirm(msg);
}
</script>
@endpush
@endsection
