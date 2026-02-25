<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Floorplan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RoomSyncController extends Controller
{
    public function index(Floorplan $floorplan): JsonResponse
    {
        abort_if($floorplan->user_id !== Auth::id(), 403);

        return response()->json($floorplan->rooms);
    }

    public function sync(Request $request, Floorplan $floorplan): JsonResponse
    {
        abort_if($floorplan->user_id !== Auth::id(), 403);

        $validated = $request->validate([
            'rooms'          => ['present', 'array'],
            'rooms.*.name'   => ['required', 'string', 'max:100'],
            'rooms.*.x'      => ['required', 'numeric', 'min:0', 'max:100'],
            'rooms.*.y'      => ['required', 'numeric', 'min:0', 'max:100'],
            'rooms.*.width'  => ['required', 'numeric', 'min:0.01', 'max:100'],
            'rooms.*.height' => ['required', 'numeric', 'min:0.01', 'max:100'],
        ]);

        DB::transaction(function () use ($floorplan, $validated) {
            $floorplan->rooms()->delete();

            foreach ($validated['rooms'] as $room) {
                $floorplan->rooms()->create([
                    'name'   => $room['name'],
                    'x'      => $room['x'],
                    'y'      => $room['y'],
                    'width'  => $room['width'],
                    'height' => $room['height'],
                ]);
            }
        });

        return response()->json(['saved' => true]);
    }
}
