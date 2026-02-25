<?php

namespace Tests\Feature;

use App\Models\Design;
use App\Models\DesignKeyEntry;
use App\Models\Floorplan;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DesignStateTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(): User
    {
        return User::factory()->create();
    }

    private function makeFloorplan(int $userId): Floorplan
    {
        return Floorplan::create([
            'user_id'   => $userId,
            'name'      => 'Ground Floor',
            'image_path' => 'fp.png',
            'width_px'  => 800,
            'height_px' => 600,
        ]);
    }

    private function makeRoom(int $floorplanId): Room
    {
        return Room::create([
            'floorplan_id' => $floorplanId,
            'name'         => 'Living Room',
            'x'            => 10.0,
            'y'            => 10.0,
            'width'        => 30.0,
            'height'       => 20.0,
        ]);
    }

    private function makeDesign(int $userId, Floorplan $floorplan): Design
    {
        $design = Design::create(['user_id' => $userId, 'name' => 'Test Design']);
        $design->floorplans()->attach($floorplan->id, ['canvas_x' => 0]);
        return $design;
    }

    // 1. test_state_requires_auth
    public function test_state_requires_auth(): void
    {
        $user    = $this->makeUser();
        $fp      = $this->makeFloorplan($user->id);
        $design  = $this->makeDesign($user->id, $fp);

        $this->get(route('api.designs.state', $design))
             ->assertRedirect(route('login'));
    }

    // 2. test_state_returns_design_json
    public function test_state_returns_design_json(): void
    {
        $user   = $this->makeUser();
        $fp     = $this->makeFloorplan($user->id);
        $room   = $this->makeRoom($fp->id);
        $design = $this->makeDesign($user->id, $fp);

        $keyEntry = $design->keyEntries()->create([
            'color_hex'  => '#ff0000',
            'label'      => 'Bedroom',
            'sort_order' => 0,
        ]);

        $design->roomHighlights()->create([
            'room_id'      => $room->id,
            'key_entry_id' => $keyEntry->id,
        ]);

        $response = $this->actingAs($user)
                         ->getJson(route('api.designs.state', $design));

        $response->assertOk()
                 ->assertJsonStructure([
                     'floorplans',
                     'key_entries',
                     'room_highlights',
                 ])
                 ->assertJsonFragment(['label' => 'Bedroom'])
                 ->assertJsonFragment(['room_id' => $room->id]);
    }

    // 3. test_state_forbidden_for_non_owner
    public function test_state_forbidden_for_non_owner(): void
    {
        $owner  = $this->makeUser();
        $other  = $this->makeUser();
        $fp     = $this->makeFloorplan($owner->id);
        $design = $this->makeDesign($owner->id, $fp);

        $this->actingAs($other)
             ->getJson(route('api.designs.state', $design))
             ->assertForbidden();
    }

    // 4. test_sync_key_entries_saves_entries
    public function test_sync_key_entries_saves_entries(): void
    {
        $user   = $this->makeUser();
        $fp     = $this->makeFloorplan($user->id);
        $design = $this->makeDesign($user->id, $fp);

        $payload = [
            'entries' => [
                ['color_hex' => '#ff0000', 'label' => 'Kitchen', 'sort_order' => 0],
                ['color_hex' => '#00ff00', 'label' => 'Bedroom', 'sort_order' => 1],
            ],
        ];

        $this->actingAs($user)
             ->putJson(route('api.designs.key-entries', $design), $payload)
             ->assertOk()
             ->assertJson(['saved' => true]);

        $this->assertDatabaseHas('design_key_entries', [
            'design_id' => $design->id,
            'color_hex' => '#ff0000',
            'label'     => 'Kitchen',
        ]);
        $this->assertDatabaseHas('design_key_entries', [
            'design_id' => $design->id,
            'color_hex' => '#00ff00',
            'label'     => 'Bedroom',
        ]);
    }

    // 5. test_sync_key_entries_validates_color_format
    public function test_sync_key_entries_validates_color_format(): void
    {
        $user   = $this->makeUser();
        $fp     = $this->makeFloorplan($user->id);
        $design = $this->makeDesign($user->id, $fp);

        $payload = [
            'entries' => [
                ['color_hex' => 'not-a-color', 'label' => 'Kitchen', 'sort_order' => 0],
            ],
        ];

        $this->actingAs($user)
             ->putJson(route('api.designs.key-entries', $design), $payload)
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['entries.0.color_hex']);
    }

    // 6. test_sync_key_entries_enforces_max_20
    public function test_sync_key_entries_enforces_max_20(): void
    {
        $user   = $this->makeUser();
        $fp     = $this->makeFloorplan($user->id);
        $design = $this->makeDesign($user->id, $fp);

        $entries = array_map(fn($i) => [
            'color_hex'  => '#ff0000',
            'label'      => "Entry {$i}",
            'sort_order' => $i,
        ], range(0, 20)); // 21 entries

        $this->actingAs($user)
             ->putJson(route('api.designs.key-entries', $design), ['entries' => $entries])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['entries']);
    }

    // 7. test_sync_key_entries_forbidden_for_non_owner
    public function test_sync_key_entries_forbidden_for_non_owner(): void
    {
        $owner  = $this->makeUser();
        $other  = $this->makeUser();
        $fp     = $this->makeFloorplan($owner->id);
        $design = $this->makeDesign($owner->id, $fp);

        $payload = [
            'entries' => [
                ['color_hex' => '#ff0000', 'label' => 'Room', 'sort_order' => 0],
            ],
        ];

        $this->actingAs($other)
             ->putJson(route('api.designs.key-entries', $design), $payload)
             ->assertForbidden();
    }

    // 8. test_sync_highlights_saves_highlights
    public function test_sync_highlights_saves_highlights(): void
    {
        $user     = $this->makeUser();
        $fp       = $this->makeFloorplan($user->id);
        $room     = $this->makeRoom($fp->id);
        $design   = $this->makeDesign($user->id, $fp);
        $keyEntry = $design->keyEntries()->create([
            'color_hex'  => '#ff0000',
            'label'      => 'Living',
            'sort_order' => 0,
        ]);

        $payload = [
            'highlights' => [
                ['room_id' => $room->id, 'key_entry_id' => $keyEntry->id],
            ],
        ];

        $this->actingAs($user)
             ->putJson(route('api.designs.highlights', $design), $payload)
             ->assertOk()
             ->assertJson(['saved' => true]);

        $this->assertDatabaseHas('design_room_highlights', [
            'design_id'    => $design->id,
            'room_id'      => $room->id,
            'key_entry_id' => $keyEntry->id,
        ]);
    }

    // 9. test_sync_highlights_forbidden_for_non_owner
    public function test_sync_highlights_forbidden_for_non_owner(): void
    {
        $owner    = $this->makeUser();
        $other    = $this->makeUser();
        $fp       = $this->makeFloorplan($owner->id);
        $room     = $this->makeRoom($fp->id);
        $design   = $this->makeDesign($owner->id, $fp);
        $keyEntry = $design->keyEntries()->create([
            'color_hex'  => '#ff0000',
            'label'      => 'Entry',
            'sort_order' => 0,
        ]);

        $payload = [
            'highlights' => [
                ['room_id' => $room->id, 'key_entry_id' => $keyEntry->id],
            ],
        ];

        $this->actingAs($other)
             ->putJson(route('api.designs.highlights', $design), $payload)
             ->assertForbidden();
    }

    // 10. test_sync_highlights_validates_room_exists
    public function test_sync_highlights_validates_room_exists(): void
    {
        $user     = $this->makeUser();
        $fp       = $this->makeFloorplan($user->id);
        $design   = $this->makeDesign($user->id, $fp);
        $keyEntry = $design->keyEntries()->create([
            'color_hex'  => '#ff0000',
            'label'      => 'Entry',
            'sort_order' => 0,
        ]);

        $payload = [
            'highlights' => [
                ['room_id' => 99999, 'key_entry_id' => $keyEntry->id],
            ],
        ];

        $this->actingAs($user)
             ->putJson(route('api.designs.highlights', $design), $payload)
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['highlights.0.room_id']);
    }

    // 11. test_sync_highlights_rejects_foreign_room_id
    public function test_sync_highlights_rejects_foreign_room_id(): void
    {
        $user        = $this->makeUser();
        $otherUser   = $this->makeUser();
        $fp          = $this->makeFloorplan($user->id);
        $foreignFp   = $this->makeFloorplan($otherUser->id);
        $foreignRoom = $this->makeRoom($foreignFp->id);
        $design      = $this->makeDesign($user->id, $fp);
        $keyEntry    = $design->keyEntries()->create([
            'color_hex'  => '#ff0000',
            'label'      => 'Entry',
            'sort_order' => 0,
        ]);

        $payload = [
            'highlights' => [
                ['room_id' => $foreignRoom->id, 'key_entry_id' => $keyEntry->id],
            ],
        ];

        $this->actingAs($user)
             ->putJson(route('api.designs.highlights', $design), $payload)
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['highlights.0.room_id']);
    }

    // 12. test_sync_highlights_rejects_foreign_key_entry_id
    public function test_sync_highlights_rejects_foreign_key_entry_id(): void
    {
        $user          = $this->makeUser();
        $otherUser     = $this->makeUser();
        $fp            = $this->makeFloorplan($user->id);
        $room          = $this->makeRoom($fp->id);
        $foreignFp     = $this->makeFloorplan($otherUser->id);
        $foreignDesign = $this->makeDesign($otherUser->id, $foreignFp);
        $foreignEntry  = $foreignDesign->keyEntries()->create([
            'color_hex'  => '#00ff00',
            'label'      => 'Foreign',
            'sort_order' => 0,
        ]);
        $design = $this->makeDesign($user->id, $fp);

        $payload = [
            'highlights' => [
                ['room_id' => $room->id, 'key_entry_id' => $foreignEntry->id],
            ],
        ];

        $this->actingAs($user)
             ->putJson(route('api.designs.highlights', $design), $payload)
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['highlights.0.key_entry_id']);
    }

    // 13. test_sync_highlights_with_empty_array_clears_highlights
    public function test_sync_highlights_with_empty_array_clears_highlights(): void
    {
        $user     = $this->makeUser();
        $fp       = $this->makeFloorplan($user->id);
        $room     = $this->makeRoom($fp->id);
        $design   = $this->makeDesign($user->id, $fp);
        $keyEntry = $design->keyEntries()->create([
            'color_hex'  => '#ff0000',
            'label'      => 'Living',
            'sort_order' => 0,
        ]);

        $design->roomHighlights()->create([
            'room_id'      => $room->id,
            'key_entry_id' => $keyEntry->id,
        ]);

        $this->actingAs($user)
             ->putJson(route('api.designs.highlights', $design), ['highlights' => []])
             ->assertOk()
             ->assertJson(['saved' => true]);

        $this->assertDatabaseMissing('design_room_highlights', [
            'design_id' => $design->id,
        ]);
    }
}
