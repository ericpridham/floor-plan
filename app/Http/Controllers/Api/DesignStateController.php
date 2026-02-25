<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Design;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DesignStateController extends Controller
{
    private function authorise(Design $design): void
    {
        abort_if($design->user_id !== Auth::id(), 403);
    }

    public function show(Design $design): JsonResponse
    {
        $this->authorise($design);

        $design->load([
            'floorplans.rooms',
            'keyEntries'      => fn($q) => $q->orderBy('sort_order'),
            'roomHighlights.keyEntry',
            'icons'           => fn($q) => $q->orderBy('z_order'),
        ]);

        return response()->json($design);
    }

    public function syncKeyEntries(Request $request, Design $design): JsonResponse
    {
        $this->authorise($design);

        $request->validate([
            'entries'              => ['required', 'array', 'max:20'],
            'entries.*.color_hex'  => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'entries.*.label'      => ['required', 'string', 'max:100'],
            'entries.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        DB::transaction(function () use ($design, $request) {
            $design->keyEntries()->delete();
            foreach ($request->input('entries') as $entry) {
                $design->keyEntries()->create([
                    'color_hex'  => $entry['color_hex'],
                    'label'      => $entry['label'],
                    'sort_order' => $entry['sort_order'],
                ]);
            }
        });

        return response()->json(['saved' => true]);
    }

    public function syncHighlights(Request $request, Design $design): JsonResponse
    {
        $this->authorise($design);

        $design->loadMissing('floorplans.rooms');
        $validRoomIds = $design->floorplans->flatMap(fn($fp) => $fp->rooms->pluck('id'));

        $request->validate([
            'highlights'                => ['present', 'array'],
            'highlights.*.room_id'      => ['required', 'integer', Rule::in($validRoomIds)],
            'highlights.*.key_entry_id' => [
                'required', 'integer',
                Rule::exists('design_key_entries', 'id')->where('design_id', $design->id),
            ],
        ]);

        DB::transaction(function () use ($design, $request) {
            $design->roomHighlights()->delete();
            foreach ($request->input('highlights') as $hl) {
                $design->roomHighlights()->create([
                    'room_id'      => $hl['room_id'],
                    'key_entry_id' => $hl['key_entry_id'],
                ]);
            }
        });

        return response()->json(['saved' => true]);
    }

    public function syncIcons(Request $request, Design $design): JsonResponse
    {
        $this->authorise($design);

        $request->validate([
            'icons'                   => ['present', 'array', 'max:500'],
            'icons.*.icon_library_id' => [
                'required', 'integer',
                Rule::exists('icon_libraries', 'id')->where(function ($query) {
                    $query->where(function ($q) {
                        $q->whereNull('user_id')
                          ->orWhere('user_id', Auth::id());
                    });
                }),
            ],
            'icons.*.x'               => ['required', 'numeric'],
            'icons.*.y'               => ['required', 'numeric'],
            'icons.*.width'           => ['required', 'numeric', 'min:0.01'],
            'icons.*.height'          => ['required', 'numeric', 'min:0.01'],
            'icons.*.rotation'        => ['required', 'numeric'],
            'icons.*.is_free_placed'  => ['required', 'boolean'],
            'icons.*.z_order'         => ['required', 'integer', 'min:0'],
        ]);

        DB::transaction(function () use ($design, $request) {
            $design->icons()->delete();
            foreach ($request->input('icons') as $icon) {
                $design->icons()->create([
                    'icon_library_id' => $icon['icon_library_id'],
                    'x'               => $icon['x'],
                    'y'               => $icon['y'],
                    'width'           => $icon['width'],
                    'height'          => $icon['height'],
                    'rotation'        => $icon['rotation'],
                    'is_free_placed'  => $icon['is_free_placed'],
                    'z_order'         => $icon['z_order'],
                ]);
            }
        });

        return response()->json(['saved' => true]);
    }
}
