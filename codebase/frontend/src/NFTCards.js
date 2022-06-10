import React from 'react'
import {
  Button,
  Card,
  Grid,
  Message,
  Modal,
  Form,
  Label,
} from 'semantic-ui-react'

import NFTAvatar from './NFTAvatar'
import { useSubstrateState } from './substrate-lib'
import { TxButton } from './substrate-lib/components'

// --- Transfer Modal ---

const TransferModal = props => {
  const { nft, setStatus } = props
  const [open, setOpen] = React.useState(false)
  const [formValue, setFormValue] = React.useState({})

  const formChange = key => (ev, el) => {
    setFormValue({ ...formValue, [key]: el.value })
  }

  const confirmAndClose = unsub => {
    setOpen(false)
    if (unsub && typeof unsub === 'function') unsub()
  }

  return (
    <Modal
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      trigger={
        <Button basic color="blue">
          Transfer
        </Button>
      }
    >
      <Modal.Header>NFT Transfer</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Input fluid label="NFT ID" readOnly value={nft.dna} />
          <Form.Input
            fluid
            label="Receiver"
            placeholder="Receiver Address"
            onChange={formChange('target')}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button basic color="grey" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <TxButton
          label="Transfer"
          type="SIGNED-TX"
          setStatus={setStatus}
          onClick={confirmAndClose}
          attrs={{
            palletRpc: 'NFT',
            callable: 'transfer',
            inputParams: [formValue.target, nft.dna],
            paramFields: [true, true],
          }}
        />
      </Modal.Actions>
    </Modal>
  )
}

// --- Set Price ---

const SetPrice = props => {
  const { nft, setStatus } = props
  const [open, setOpen] = React.useState(false)
  const [formValue, setFormValue] = React.useState({})

  const formChange = key => (ev, el) => {
    setFormValue({ ...formValue, [key]: el.value })
  }

  const confirmAndClose = unsub => {
    setOpen(false)
    if (unsub && typeof unsub === 'function') unsub()
  }

  return (
    <Modal
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      trigger={
        <Button basic color="blue">
          Set Price
        </Button>
      }
    >
      <Modal.Header>Set NFT Price</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Input fluid label="NFT ID" readOnly value={nft.dna} />
          <Form.Input
            fluid
            label="Price"
            placeholder="Enter Price"
            onChange={formChange('target')}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button basic color="grey" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <TxButton
          label="Set Price"
          type="SIGNED-TX"
          setStatus={setStatus}
          onClick={confirmAndClose}
          attrs={{
            palletRpc: 'NFT',
            callable: 'setPrice',
            inputParams: [nft.dna, formValue.target],
            paramFields: [true, true],
          }}
        />
      </Modal.Actions>
    </Modal>
  )
}

// --- Buy NFT ---

const BuyNFT = props => {
  const { nft, setStatus } = props
  const [open, setOpen] = React.useState(false)

  const confirmAndClose = unsub => {
    setOpen(false)
    if (unsub && typeof unsub === 'function') unsub()
  }

  if (!nft.price) {
    return <></>
  }

  return (
    <Modal
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      trigger={
        <Button basic color="green">
          Buy NFT
        </Button>
      }
    >
      <Modal.Header>Buy NFT</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Input fluid label="NFT ID" readOnly value={nft.dna} />
          <Form.Input fluid label="Price" readOnly value={nft.price} />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button basic color="grey" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <TxButton
          label="Buy NFT"
          type="SIGNED-TX"
          setStatus={setStatus}
          onClick={confirmAndClose}
          attrs={{
            palletRpc: 'NFT',
            callable: 'buyNFT',
            inputParams: [nft.dna, nft.price],
            paramFields: [true, true],
          }}
        />
      </Modal.Actions>
    </Modal>
  )
}

// --- About NFT Card ---

const NFTCard = props => {
  const { nft, setStatus } = props
  const { dna = null, owner = null, gender = null, price = null } = nft
  const displayDna = dna && dna.toJSON()
  const { currentAccount } = useSubstrateState()
  const isSelf = currentAccount.address === nft.owner

  return (
    <Card>
      {isSelf && (
        <Label as="a" floating color="teal">
          Mine
        </Label>
      )}
      <NFTAvatar dna={dna.toU8a()} />
      <Card.Content>
        <Card.Meta style={{ fontSize: '.9em', overflowWrap: 'break-word' }}>
          DNA: {displayDna}
        </Card.Meta>
        <Card.Description>
          <p style={{ overflowWrap: 'break-word' }}>Gender: {gender}</p>
          <p style={{ overflowWrap: 'break-word' }}>Owner: {owner}</p>
          <p style={{ overflowWrap: 'break-word' }}>
            Price: {price || 'Not For Sale'}
          </p>
        </Card.Description>
      </Card.Content>
      <Card.Content extra style={{ textAlign: 'center' }}>
        {owner === currentAccount.address ? (
          <>
            <SetPrice nft={nft} setStatus={setStatus} />
            <TransferModal nft={nft} setStatus={setStatus} />
          </>
        ) : (
          <>
            <BuyNFT nft={nft} setStatus={setStatus} />
          </>
        )}
      </Card.Content>
    </Card>
  )
}

const NFTCards = props => {
  const { nfts, setStatus } = props

  if (nfts.length === 0) {
    return (
      <Message info>
        <Message.Header>
          No NFT found here... Create one now!&nbsp;
          <span role="img" aria-label="point-down">
            👇
          </span>
        </Message.Header>
      </Message>
    )
  }

  return (
    <Grid columns={3}>
      {nfts.map((nft, i) => (
        <Grid.Column key={`nft-${i}`}>
          <NFTCard nft={nft} setStatus={setStatus} />
        </Grid.Column>
      ))}
    </Grid>
  )
}

export default NFTCards
