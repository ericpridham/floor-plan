<?php

namespace App\Http\Controllers;

use App\Models\Floorplan;
use Illuminate\Support\Facades\Auth;

class FloorplanSetupController extends Controller
{
    public function show(Floorplan $floorplan)
    {
        abort_if($floorplan->user_id !== Auth::id(), 403);

        $rooms = $floorplan->rooms;

        return view('floorplans.setup', compact('floorplan', 'rooms'));
    }
}
