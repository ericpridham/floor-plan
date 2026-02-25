<?php

namespace App\Http\Controllers;

use App\Models\Floorplan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FloorplanController extends Controller
{
    public function create()
    {
        return view('floorplans.create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'  => ['required', 'string', 'max:100'],
            'image' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:20480'],
        ]);

        $file = $request->file('image');

        // Validate dimensions before storing
        $info = getimagesize($file->getRealPath());
        abort_if($info === false, 422, 'Could not read image dimensions.');
        [$width, $height] = $info;

        $mimeToExt = [
            'image/png'  => 'png',
            'image/jpeg' => 'jpg',
            'image/webp' => 'webp',
        ];
        $ext  = $mimeToExt[$file->getMimeType()] ?? 'png';
        $path = "floorplans/" . Auth::id() . "/" . Str::uuid() . "." . $ext;

        Storage::disk('public')->putFileAs(
            dirname($path),
            $file,
            basename($path)
        );

        Floorplan::create([
            'user_id'    => Auth::id(),
            'name'       => $request->input('name'),
            'image_path' => $path,
            'width_px'   => $width,
            'height_px'  => $height,
        ]);

        return redirect()->route('dashboard')->with('status', 'Floorplan uploaded successfully.');
    }

    public function update(Request $request, Floorplan $floorplan)
    {
        abort_if($floorplan->user_id !== Auth::id(), 403);

        $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $floorplan->update(['name' => $request->input('name')]);

        return redirect()->route('dashboard')->with('status', 'Floorplan renamed.');
    }

    public function destroy(Floorplan $floorplan)
    {
        abort_if($floorplan->user_id !== Auth::id(), 403);

        $floorplan->deleteImage();
        $floorplan->delete();

        return redirect()->route('dashboard')->with('status', 'Floorplan deleted.');
    }
}
