@extends('layouts.app')

@section('title', 'Upload Floorplan')

@section('content')
<div class="max-w-xl mx-auto">
    <div class="mb-6 flex items-center gap-3">
        <a href="{{ route('dashboard') }}" class="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <span class="text-gray-300">/</span>
        <h1 class="text-xl font-semibold text-gray-900">Upload Floorplan</h1>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <form method="POST" action="{{ route('floorplans.store') }}" enctype="multipart/form-data">
            @csrf

            <div class="mb-5">
                <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Floorplan name</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value="{{ old('name') }}"
                    required
                    maxlength="100"
                    placeholder="e.g. Ground Floor"
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 @error('name') border-red-400 bg-red-50 @else border-gray-300 @enderror"
                >
                @error('name')
                    <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                @enderror
            </div>

            <div class="mb-6">
                <label for="image" class="block text-sm font-medium text-gray-700 mb-1">Image file</label>
                <div class="relative">
                    <input
                        type="file"
                        id="image"
                        name="image"
                        required
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 @error('image') border border-red-400 rounded-lg p-1 @enderror"
                    >
                </div>
                @error('image')
                    <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                @enderror
                <p class="mt-1 text-xs text-gray-500">PNG, JPEG or WebP · Max 20 MB</p>
            </div>

            <div class="flex gap-3">
                <button type="submit" class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                    Upload
                </button>
                <a href="{{ route('dashboard') }}" class="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                    Cancel
                </a>
            </div>
        </form>
    </div>
</div>
@endsection
