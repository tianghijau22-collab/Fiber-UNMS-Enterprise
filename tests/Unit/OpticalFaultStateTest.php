<?php

namespace Tests\Unit;

use App\Services\OpticalFaultState as State;
use PHPUnit\Framework\TestCase;

class OpticalFaultStateTest extends TestCase
{
    private function at(int $ago): string { return date(DATE_ATOM, time() - $ago); }

    public function test_existing_outages_and_newly_mapped_nodes_establish_a_quiet_baseline(): void
    {
        $r = State::advance(null, 'down', $this->at(30), 'members');
        $this->assertTrue($r['record']['active']);
        $this->assertFalse($r['record']['notified']);
        $this->assertNull($r['transition']);
        $r = State::advance($r['record'], 'up', $this->at(20), 'changed-members');
        $this->assertNull($r['transition']);
        $this->assertFalse($r['record']['active']);
    }

    public function test_two_distinct_samples_spaced_at_least_five_seconds_confirm_a_transition_once(): void
    {
        $r = State::advance(null, 'up', $this->at(40), 'a');
        $r = State::advance($r['record'], 'down', $this->at(30), 'a');
        $this->assertNull($r['transition']);
        for ($i = 0; $i < 4; $i++) $r = State::advance($r['record'], 'down', $this->at(30), 'a');
        $this->assertNull($r['transition']);
        $r = State::advance($r['record'], 'down', $this->at(28), 'a');
        $this->assertNull($r['transition']);
        $r = State::advance($r['record'], 'down', $this->at(24), 'a');
        $this->assertSame('outage', $r['transition']);
        $r = State::advance($r['record'], 'down', $this->at(10), 'a');
        $this->assertNull($r['transition']);
    }

    public function test_unknown_or_partial_evidence_resets_confirmation_without_clearing_an_active_alarm(): void
    {
        $r = State::advance(null, 'down', $this->at(40), 'a');
        foreach (['unknown', 'partial'] as $condition) {
            $r = State::advance($r['record'], 'up', $this->at(30), 'a');
            $r = State::advance($r['record'], $condition, $this->at(25), 'a');
            $this->assertTrue($r['record']['active']);
            $this->assertNull($r['record']['pending']);
            $r = State::advance($r['record'], 'up', $this->at(20), 'a');
            $this->assertNull($r['transition']);
        }
    }

    public function test_stale_future_missing_and_reordered_samples_cannot_create_transitions(): void
    {
        $r = State::advance(null, 'up', $this->at(50), 'a');
        foreach ([null, $this->at(181), $this->at(-10)] as $at) {
            $r = State::advance($r['record'], 'down', $at, 'a');
            $this->assertNull($r['transition']);
            $this->assertFalse($r['record']['active']);
        }
        $r = State::advance($r['record'], 'down', $this->at(20), 'a');
        $r = State::advance($r['record'], 'down', $this->at(30), 'a');
        $this->assertNull($r['transition']);
    }

    public function test_flapping_requires_a_new_run_of_consistent_observations(): void
    {
        $r = State::advance(null, 'up', $this->at(50), 'a');
        $r = State::advance($r['record'], 'down', $this->at(40), 'a');
        $r = State::advance($r['record'], 'up', $this->at(35), 'a');
        $r = State::advance($r['record'], 'down', $this->at(30), 'a');
        $this->assertNull($r['transition']);
        $r = State::advance($r['record'], 'down', $this->at(20), 'a');
        $this->assertSame('outage', $r['transition']);
        $r = State::advance($r['record'], 'up', $this->at(10), 'a');
        $r = State::advance($r['record'], 'up', $this->at(2), 'a');
        $this->assertSame('recovery', $r['transition']);
    }
}
