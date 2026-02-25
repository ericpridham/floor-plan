<?php
namespace App\Http\Controllers;

use App\Models\Design;
use App\Models\Floorplan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DesignController extends Controller
{
    public function create()
    {
        $floorplans = Auth::user()->floorplans()->withCount('rooms')->latest()->get();
        return view('designs.create', compact('floorplans'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'            => ['required', 'string', 'max:100'],
            'floorplan_ids'   => ['required', 'array', 'min:1'],
            'floorplan_ids.*' => ['integer', 'exists:floorplans,id'],
        ]);

        $userId       = Auth::id();
        $requestedIds = array_unique($request->input('floorplan_ids'));

        $validIds = Floorplan::whereIn('id', $requestedIds)
                             ->where('user_id', $userId)
                             ->pluck('id');

        if ($validIds->count() !== count($requestedIds)) {
            abort(403);
        }

        $design = Design::create(['user_id' => $userId, 'name' => $request->input('name')]);

        $offset = 0;
        foreach ($requestedIds as $fpId) {
            $design->floorplans()->attach($fpId, ['canvas_x' => $offset]);
            $offset += 1200;
        }

        return redirect()->route('designs.show', $design)->with('status', 'Design created.');
    }

    public function show(Design $design)
    {
        abort_if($design->user_id !== Auth::id(), 403);
        return view('designs.show', compact('design'));
    }

    public function update(Request $request, Design $design)
    {
        abort_if($design->user_id !== Auth::id(), 403);
        $request->validate(['name' => ['required', 'string', 'max:100']]);
        $design->update(['name' => $request->input('name')]);
        return redirect()->route('dashboard')->with('status', 'Design renamed.');
    }

    public function destroy(Design $design)
    {
        abort_if($design->user_id !== Auth::id(), 403);
        $design->delete();
        return redirect()->route('dashboard')->with('status', 'Design deleted.');
    }
}
