import {it,expect} from 'vitest';
import {balanceBadgeValue} from '../src/components/HeyGenBalanceBadge';
it('preserves dollar balance and zero',()=>{expect(balanceBadgeValue([{label:'API balance',value:0,unit:'usd'}])).toEqual({value:0,unit:'usd'});});
it('sums available credit pools',()=>{expect(balanceBadgeValue([{label:'Premium credits',value:3,unit:'credits'},{label:'Add-on credits',value:2,unit:'credits'}])).toEqual({value:5,unit:'credits'});});
it('does not show metered spending as available credits',()=>{expect(balanceBadgeValue([{label:'Current API spend',value:100,unit:'usd'}])).toBeNull();});
