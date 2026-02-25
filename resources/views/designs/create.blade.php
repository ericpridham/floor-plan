@extends('layouts.app')
@section('title', 'New Design')
@section('content')
<div class="max-w-2xl mx-auto">
    <div class="mb-6 flex items-center gap-3">
        <a href="{{ route('dashboard') }}" class="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <span class="text-gray-300">/</span>
        <h1 class="text-xl font-semibold text-gray-900">New Design</h1>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <form method="POST" action="{{ route('designs.store') }}">
            @csrf

            <div class="mb-6">
                <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Design name</label>
                <input type="text" id="name" name="name" value="{{ old('name') }}" required maxlength="100"
                    placeholder="e.g. Ground Floor Layout"
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 @error('name') border-red-400 bg-red-50 @else border-gray-300 @enderror">
                @error('name')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror
            </div>

            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    Select floorplans <span class="text-gray-400 font-normal">(select at least one)</span>
                </label>
                @error('floorplan_ids')<p class="mb-2 text-xs text-red-600">{{ $message }}</p>@enderror

                @if ($floorplans->isEmpty())
                    <p class="text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                        No floorplans yet.
                        <a href="{{ route('floorplans.create') }}" class="text-indigo-600 hover:underline">Upload one first.</a>
                    </p>
                @else
                    <div class="space-y-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 p-3">
                        @foreach ($floorplans as $fp)
                        <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" name="floorplan_ids[]" value="{{ $fp->id }}"
                                {{ in_array($fp->id, old('floorplan_ids', [])) ? 'checked' : '' }}
                                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                            <img src="{{ $fp->thumbnail_url }}" alt="{{ $fp->name }}"
                                class="w-16 h-10 object-cover rounded border border-gray-200 bg-gray-100">
                            <div>
                                <p class="text-sm font-medium text-gray-900">{{ $fp->name }}</p>
                                <p class="text-xs text-gray-400">{{ $fp->rooms_count }} {{ $fp->rooms_count === 1 ? 'room' : 'rooms' }}</p>
                            </div>
                        </label>
                        @endforeach
                    </div>
                @endif
            </div>

            <div class="flex gap-3">
                <button type="submit"
                    class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                    Create Design
                </button>
                <a href="{{ route('dashboard') }}"
                    class="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                    Cancel
                </a>
            </div>
        </form>
    </div>
</div>
@endsection
