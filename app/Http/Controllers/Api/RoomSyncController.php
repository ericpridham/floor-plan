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
            'rooms'                => ['present', 'array'],
            'rooms.*.name'         => ['required', 'string', 'max:100'],
            'rooms.*.x'            => ['nullable', 'numeric', 'min:0', 'max:100'],
            'rooms.*.y'            => ['nullable', 'numeric', 'min:0', 'max:100'],
            'rooms.*.width'        => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'rooms.*.height'       => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'rooms.*.vertices'     => ['nullable', 'array', 'min:3', 'max:100'],
            'rooms.*.vertices.*.x' => ['required', 'numeric', 'min:0', 'max:100'],
            'rooms.*.vertices.*.y' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        // Ensure each room has either vertices or rect coordinates, and polygon bounding boxes are non-degenerate
        foreach ($validated['rooms'] as $i => $room) {
            $hasVertices = !empty($room['vertices']);
            $hasRect     = isset($room['x'], $room['y'], $room['width'], $room['height']);
            if (! $hasVertices && ! $hasRect) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors'  => ["rooms.$i" => ['Room must have either vertices (polygon) or x/y/width/height (rectangle).']],
                ], 422);
            }
            if ($hasVertices) {
                $xs = array_column($room['vertices'], 'x');
                $ys = array_column($room['vertices'], 'y');
                if ((max($xs) - min($xs)) < 0.01 || (max($ys) - min($ys)) < 0.01) {
                    return response()->json([
                        'message' => 'Validation failed',
                        'errors'  => ["rooms.$i" => ['Polygon room vertices must form a non-degenerate shape (cannot be collinear in a single axis).']],
                    ], 422);
                }
            }
        }

        DB::transaction(function () use ($floorplan, $validated) {
            $floorplan->rooms()->delete();

            foreach ($validated['rooms'] as $room) {
                if (! empty($room['vertices'])) {
                    $vertices = $room['vertices'];
                    $xs       = array_column($vertices, 'x');
                    $ys       = array_column($vertices, 'y');
                    $minX     = min($xs);
                    $minY     = min($ys);
                    $floorplan->rooms()->create([
                        'name'     => $room['name'],
                        'vertices' => $vertices,
                        'x'        => $minX,
                        'y'        => $minY,
                        'width'    => max($xs) - $minX,
                        'height'   => max($ys) - $minY,
                    ]);
                } else {
                    $floorplan->rooms()->create([
                        'name'     => $room['name'],
                        'x'        => $room['x'],
                        'y'        => $room['y'],
                        'width'    => $room['width'],
                        'height'   => $room['height'],
                        'vertices' => null,
                    ]);
                }
            }
        });

        return response()->json(['saved' => true]);
    }
}
