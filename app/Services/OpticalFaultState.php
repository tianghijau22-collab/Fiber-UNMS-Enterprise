<?php

namespace App\Services;

/** Debounce observed transitions; repeated reads, unknown evidence and topology edits cannot confirm recovery. */
class OpticalFaultState
{
    public static function advance(?array $previous, string $condition, ?string $sampledAt, string $members): array
    {
        $record = $previous ?? ['active'=>false, 'notified'=>false, 'initialized'=>false, 'pending'=>null];
        $record['condition'] = $condition;
        $at = is_string($sampledAt) ? strtotime($sampledAt) : false;
        if (!in_array($condition, ['down', 'up'], true) || $at === false || $at > time() + 5 || $at < time() - 180) {
            $record['condition'] = in_array($condition, ['down', 'up'], true) ? 'unknown' : $condition;
            $record['pending'] = null;
            return ['record'=>$record, 'transition'=>null];
        }
        if ($record['initialized'] && $at < ($record['last_observed_at'] ?? 0)) return ['record'=>$previous, 'transition'=>null];
        $record['last_observed_at'] = $at;
        // Establish a quiet baseline for existing outages, including newly mapped topology.
        if (!$record['initialized'] || ($record['members'] ?? null) !== $members) {
            $record = array_replace($record, ['active'=>$condition === 'down', 'notified'=>false,
                'initialized'=>true, 'members'=>$members, 'pending'=>null, 'baseline_at'=>$sampledAt]);
            return ['record'=>$record, 'transition'=>null];
        }
        if (($condition === 'down') === $record['active']) {
            $record['pending'] = null;
            return ['record'=>$record, 'transition'=>null];
        }
        $pending = $record['pending'];
        if (!$pending || $pending['condition'] !== $condition) {
            $record['pending'] = ['condition'=>$condition, 'first_at'=>$at, 'last_at'=>$at];
            return ['record'=>$record, 'transition'=>null];
        }
        if ($at <= $pending['last_at']) return ['record'=>$record, 'transition'=>null];
        $record['pending']['last_at'] = $at;
        if ($at - $pending['first_at'] < 5) return ['record'=>$record, 'transition'=>null];
        $record['pending'] = null;
        $record['active'] = $condition === 'down';
        return ['record'=>$record, 'transition'=>$condition === 'down' ? 'outage' : 'recovery'];
    }
}
