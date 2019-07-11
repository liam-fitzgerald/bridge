import React from 'react';
import cn from 'classnames';

import Grid from './Grid';
import Flex from './Flex';
import { HelpText } from './Typography';

export default function Button({
  as: As = 'a',
  solid = false,
  success = false,
  disabled = false,
  detail,
  className,
  accessory = '→',
  onClick,
  children,
  ...rest
}) {
  const textColor = {
    white: solid,
    black: !solid && !disabled,
    gray4: !solid && disabled,
  };
  return (
    <Grid
      as={As}
      gap={2}
      className={cn(
        'pointer pv3 truncate flex-row justify-between bt1 bp1 b-gray2',
        {
          p4: solid,
        },
        {
          'bg-green3': success && !disabled,
          'bg-green1': success && disabled,
          'bg-black': !success && solid && !disabled,
          'bg-gray3': !success && solid && disabled,
          'bg-transparent': !success && !solid,
        },
        className
      )}
      style={{
        ...(disabled && {
          pointerEvents: 'none',
          cursor: 'not-allowed',
        }),
      }}
      onClick={!disabled && onClick ? onClick : undefined}
      {...rest}>
      <Grid.Item as={Flex} justify="between" full>
        <span className={cn(textColor)}>{children}</span>
        <div className={cn('pl4', textColor)}>{accessory}</div>
      </Grid.Item>
      {detail && (
        <Grid.Item as={HelpText} full>
          {detail}
        </Grid.Item>
      )}
    </Grid>
  );
}
