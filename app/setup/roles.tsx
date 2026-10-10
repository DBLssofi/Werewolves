import { router } from 'expo-router';
import { View } from 'react-native';
import { balanceTotals, suggestedWolves, validateSetup, type SetupProblem } from '@/engine/setup';
import type { RoleCount, RoleGroup } from '@/engine/types';
import { ROLES } from '@/packs/werewolves/roles';
import { useGame } from '@/state/GameStore';
import { Button, Counter, Panel, Screen, TopBar, Txt } from '@/ui/kit';
import { useNames } from '@/ui/useNames';

const lookup = (id: string) => ROLES.find((r) => r.id === id);
const GROUPS: RoleGroup[] = ['core', 'info', 'protector', 'killer', 'copier', 'bond', 'animal', 'neutral', 'wolf'];

export default function Roles() {
  const { t, role } = useNames();
  const { draft, updateDraft, beginDeal } = useGame();
  const editable = draft.mode === 'custom';
  const count = (id: string) => draft.roles.find((r) => r.roleId === id)?.count ?? 0;
  const setCount = (id: string, n: number) => {
    const rest = draft.roles.filter((r) => r.roleId !== id);
    updateDraft({ roles: n > 0 ? [...rest, { roleId: id, count: n }] : rest });
  };
  const problems = validateSetup(draft.players, draft.roles, lookup);
  const cards = draft.roles.reduce((s, r) => s + r.count, 0);
  const { balance } = balanceTotals(draft.roles, lookup);
  const problemText = (p: SetupProblem) => {
    switch (p.kind) {
      case 'tooManyCopies':
        return t('custom.problem.tooManyCopies', { role: role(p.roleId) });
      case 'tooFewCopies':
        return t('custom.problem.tooFewCopies', { role: role(p.roleId), min: p.minimum });
      case 'missingPartner':
        return t('custom.problem.missingPartner', { role: role(p.roleId), partner: role(p.requires) });
      default:
        return t(`custom.problem.${p.kind}`);
    }
  };
  const list: RoleCount[] = editable ? [] : draft.roles;
  return (
    <Screen
      top={<TopBar title={t('custom.title')} backLabel={t('common.back')} onBack={() => router.back()} />}
      bottom={
        <Button
          label={t('common.continue')}
          disabled={problems.length > 0}
          onPress={() => {
            beginDeal();
            router.push('/deal');
          }}
        />
      }
    >
      <View style={{ marginTop: 80, gap: 4 }}>
        <Txt variant="option">{t('custom.count', { chosen: cards, players: draft.players })}</Txt>
        <Txt variant="small" tone="muted">
          {t('custom.balance', { score: balance > 0 ? `+${balance}` : balance })} · {t('custom.suggested', { wolves: suggestedWolves(draft.players) })}
        </Txt>
      </View>
      {problems.length > 0 && cards > 0 && (
        <Panel>
          <Txt variant="caps" tone="accent">
            {t('custom.problems')}
          </Txt>
          {problems.map((p, i) => (
            <Txt key={i} variant="small">
              • {problemText(p)}
            </Txt>
          ))}
        </Panel>
      )}
      {!editable &&
        list.map((r) => (
          <View key={r.roleId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt variant="option">{role(r.roleId)}</Txt>
            <Txt variant="option" tone="muted">
              × {r.count}
            </Txt>
          </View>
        ))}
      {editable &&
        GROUPS.map((g) => (
          <View key={g} style={{ gap: 8 }}>
            <Txt variant="caps" tone="muted">
              {t(`custom.groups.${g}`)}
            </Txt>
            {ROLES.filter((r) => r.group === g).map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Txt>{role(r.id)}</Txt>
                  <Txt variant="small" tone="muted">
                    {r.score > 0 ? `+${r.score}` : r.score}
                  </Txt>
                </View>
                <Counter
                  small
                  value={count(r.id)}
                  min={0}
                  max={r.copies === 'unlimited' ? draft.players : r.copies}
                  onChange={(n) => setCount(r.id, n)}
                  minusLabel={t('common.minus')}
                  plusLabel={t('common.plus')}
                />
              </View>
            ))}
          </View>
        ))}
    </Screen>
  );
}
