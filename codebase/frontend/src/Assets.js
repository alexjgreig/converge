import React, { useEffect, useState } from 'react'
import { Form, Input, Grid, Item } from 'semantic-ui-react'

import { useSubstrateState } from './substrate-lib'
import { TxButton } from './substrate-lib/components'

export default function Assets(props) {
  const { api } = useSubstrateState()

  // The transaction submission status
  const [status, setStatus] = useState('')

  // The currently stored value
  const [currentValue, setCurrentValue] = useState(0)
  const [formValue, setFormValue] = useState(0)

  useEffect(() => {
    let unsubscribe
    api.query.templateModule
      .something(newValue => {
        // The storage value is an Option<u32>
        // So we have to check whether it is None first
        // There is also unwrapOr
        if (newValue.isNone) {
          setCurrentValue('<None>')
        } else {
          setCurrentValue(newValue.unwrap().toNumber())
        }
      })
      .then(unsub => {
        unsubscribe = unsub
      })
      .catch(console.error)

    return () => unsubscribe && unsubscribe()
  }, [api.query.templateModule])

	if (nfts.length === 0) {
    return (
    <Grid.Column width={8}>
      <h1>Fungible Assets</h1>
      <Message info>
        <Message.Header>
          No Fungible Assets Created... Create one now in the blockchain interactor!&nbsp;
          <span role="img" aria-label="point-down">
            👇
          </span>
        </Message.Header>
      </Message>
    </Grid>
    )
  }

  return (
    <Grid.Column width={8}>
      <h1>Fungible Assets</h1>
	<Item.Group>
    <Grid columns={3}>
      {nfts.map((nft, i) => (
        <Grid.Column key={`nft-${i}`}>
    <Item>
      <Item.Image size='tiny' src='/img/coin.png' />

      <Item.Content>
        <Item.Header as='a'>Header</Item.Header>
        <Item.Meta>Description</Item.Meta>
        <Item.Description>
          <Image src='/img/coin.png' />
        </Item.Description>
        <Item.Extra>

	  </Item.Extra>
      </Item.Content>
    </Item>
      ))}
</Grid.Column>
  </Item.Group>
    </Grid>
  )
}

